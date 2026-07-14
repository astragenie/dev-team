// scripts/lib/memory/inject-profile.ts — FEAT (agent-profile load). Sibling of
// inject-recall.ts. Formats the agent's astramem profile into a
// `## Your track record (<agent>)` block. Corrections lead (deterministic,
// day-one value), then recent decisions, then top lessons. Each line carries
// its atom id in an HTML-comment marker so the feedback step can attribute use.
// Fail-silent + byte-identical-when-disabled is enforced in buildProfileBlock
// (Task 3); this module is a pure formatter.
import { loadMemoryConfig } from "./inject-recall.ts";
import type { AgentProfile, ProfileCapableProvider } from "./profile-types.ts";

/** Trailing marker carrying an atom id — invisible in rendered Markdown,
 *  machine-readable by the feedback step (Task 5). */
export function atomMarker(id: string): string {
  return ` <!--atom:${id}-->`;
}

export interface FormatProfileOptions {
  agent: string;
  /** Hard character budget (shared sub-allocation, ~4 chars/token). */
  maxChars: number;
  /** True once enough atoms carry a real usefulness signal; false => lessons
   *  are labelled importance-ranked to avoid implying a dead ranking is meaningful. */
  usefulnessWarm: boolean;
}

export function formatProfileBlock(profile: AgentProfile, opts: FormatProfileOptions): string {
  const lines: string[] = [];
  for (const c of profile.corrections) {
    lines.push(`- **[correction ${c.action}]** ${c.text}${atomMarker(c.id)}`);
  }
  for (const d of profile.recent_decisions) {
    lines.push(`- **[decision]** ${d.text}${atomMarker(d.id)}`);
  }
  const lessonLabel = opts.usefulnessWarm ? "lesson" : "lesson · importance-ranked";
  for (const l of profile.top_lessons) {
    lines.push(`- **[${lessonLabel}]** ${l.text}${atomMarker(l.id)}`);
  }
  if (lines.length === 0) return "";

  const header = `## Your track record (${opts.agent})`;
  let block = `${header}\n${lines.join("\n")}`;
  if (block.length > opts.maxChars) {
    // Deterministic truncation: keep the header + as many leading lines
    // (corrections first) as fit. Never split a line.
    const kept: string[] = [];
    let used = header.length;
    for (const line of lines) {
      if (used + 1 + line.length > opts.maxChars) break;
      kept.push(line);
      used += 1 + line.length;
    }
    block = kept.length === 0 ? header.slice(0, opts.maxChars) : `${header}\n${kept.join("\n")}`;
  }
  return block;
}

export interface ProfileConfig {
  enabled: boolean;
  topLessons: number;
  maxTokens: number;
  minFeedbackSample: number;
}

const PROFILE_DEFAULTS: ProfileConfig = { enabled: false, topLessons: 10, maxTokens: 400, minFeedbackSample: 5 };

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/**
 * Parse the `memory.profile.*` block. Disabled-by-default: absent/malformed
 * `memory` or `profile` (or a non-object `profile`) resolves to safe
 * defaults with `enabled: false`. Never throws.
 */
export function parseProfileConfig(rawMemory: unknown): ProfileConfig {
  if (typeof rawMemory !== "object" || rawMemory === null) return { ...PROFILE_DEFAULTS };
  const p = (rawMemory as Record<string, unknown>).profile;
  if (typeof p !== "object" || p === null) return { ...PROFILE_DEFAULTS };
  const o = p as Record<string, unknown>;
  return {
    enabled: o.enabled === true,
    topLessons: num(o.topLessons, PROFILE_DEFAULTS.topLessons),
    maxTokens: num(o.maxTokens, PROFILE_DEFAULTS.maxTokens),
    minFeedbackSample: num(o.minFeedbackSample, PROFILE_DEFAULTS.minFeedbackSample)
  };
}

export interface BuildProfileOptions {
  repoPath: string;
  agent: string;
  /** Raw `memory` config; when omitted, loaded from <repoPath>/.claude/loop.json. */
  rawConfig?: unknown;
  /** Test seam / explicit provider; when omitted, resolveProvider() is used. */
  provider?: ProfileCapableProvider;
}

/** True once at least `minSample` lessons carry a moved usefulness signal
 *  (!= the Laplace-neutral 0.5). Below that, the ranking is effectively
 *  importance-ordered and must be labelled so. */
function usefulnessIsWarm(profile: AgentProfile, minSample: number): boolean {
  const moved = profile.top_lessons.filter((l) => l.usefulness !== 0.5).length;
  return moved >= minSample;
}

/**
 * Resolve the configured provider, gate on `memory.profile.enabled`, fetch
 * the agent's profile, and format it into the `## Your track record` block.
 * Fail-silent: config errors, provider errors, a throwing provider, a
 * provider lacking `profile()`, or a null profile all resolve to
 * `{ block: "", injectedIds: [] }` — never a throw.
 */
export async function buildProfileBlock(opts: BuildProfileOptions): Promise<{ block: string; injectedIds: string[] }> {
  const empty = { block: "", injectedIds: [] as string[] };
  try {
    const rawConfig = opts.rawConfig !== undefined ? opts.rawConfig : await loadMemoryConfig(opts.repoPath);
    const cfg = parseProfileConfig(rawConfig);
    if (!cfg.enabled) return empty;

    let provider = opts.provider;
    if (!provider) {
      const { resolveProvider } = await import("@astragenie/memory-provider");
      provider = resolveProvider(rawConfig, opts.repoPath) as unknown as ProfileCapableProvider;
    }
    if (typeof provider.profile !== "function") return empty; // package hasn't shipped it yet

    const profile = await provider.profile(opts.agent);
    if (!profile) return empty;

    // Enforce topLessons cap before formatting (daemon already caps at 10; be defensive).
    profile.top_lessons = profile.top_lessons.slice(0, cfg.topLessons);

    const block = formatProfileBlock(profile, {
      agent: opts.agent,
      maxChars: cfg.maxTokens * 4,
      usefulnessWarm: usefulnessIsWarm(profile, cfg.minFeedbackSample)
    });
    if (!block) return empty;

    const injectedIds = [
      ...profile.corrections.map((c) => c.id),
      ...profile.recent_decisions.map((d) => d.id),
      ...profile.top_lessons.map((l) => l.id)
    ];
    return { block, injectedIds };
  } catch {
    return empty; // fail-silent: never block or alter dispatch
  }
}
