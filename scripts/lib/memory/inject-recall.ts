// scripts/lib/memory/inject-recall.ts — FEAT-188 S3a, project/agent scoping
// per astragenie/dev-team#159 (astramem-local v0.7.0 / plugin v0.6.0,
// FEAT-423).
//
// The ONE recall injection helper every dev-team dispatch-assembly site
// (commands/build.md, commands/fix.md, commands/ship.md retries,
// commands/orchestrate-slice.md) calls before handing an instruction to a
// subagent. Given the dispatch text + {agent, tags, project}, it resolves
// the configured MemoryProvider (@astragenie/memory-provider's
// resolveProvider), recalls entries scoped by agent/tags/project within the
// configured token budget, and appends a formatted block.
//
// Format: reuses/extends the runner-plugin bridge's EXISTING
// `## Prior context (from astramem)` header (recall-injector.mts's
// formatRecallBlock) rather than inventing a rival format — S3b unifies
// both sides of the bridge/dev-team split on this one shape. The per-line
// shape differs because MemoryEntry carries kind/severity/source/summary,
// not the bridge's RecallResult type/score/slice_id/content — same header,
// adapted line.
//
// Project scoping (#159): @astragenie/memory-provider@0.1.0's `RecallQuery`
// contract only carries {agent, tags, k, maxTokens} — no `project` field —
// so the generic `provider.recall()` path cannot forward project scope.
// The pinned astramem-plugin dependency's wire-level `WireProvider.recall()`
// DOES already support project (FEAT-423, verified against the git-pinned
// sha in package.json — newer than the v0.6.0 tag). So when astramem is the
// configured provider and a project is known, this module bypasses the
// generic recall() and calls the wire provider directly via the already
// package-exported `resolveAstramemRemote()`, mapping hits with the same
// degraded-fidelity approach astramem-provider.ts uses internally for its
// own paired+dualWrite:false branch (RecallHit carries no ts/tags — see
// mapWireHitsToEntries below). Any failure (unpaired, network, throw) falls
// through to the standard agent/tag-scoped path so recall never breaks when
// astramem is unpaired or no project is configured. Once
// @astragenie/memory-provider grows a `project` field on RecallQuery
// upstream, this local bypass can be deleted in favor of the generic path.
//
// Guard: best-effort. A recall failure (config parse error, provider error,
// timeout) must never block or alter dispatch beyond omitting the block —
// every path here is wrapped so the caller always gets text back, never a
// throw.
import fs from "node:fs/promises";
import path from "node:path";
import type { RecallHit } from "@astragenie/astramem-client";
import {
  type EffectiveMemoryConfig,
  MemoryEntrySchema,
  parseMemoryConfig,
  resolveAstramemRemote,
  resolveEffectiveConfig,
  resolveProvider,
  type MemoryEntry
} from "@astragenie/memory-provider";

/** Mirrors astramem-provider.ts's MAX_SUMMARY_LENGTH for the same
 * degraded-fidelity wire-hit mapping (not exported by the package). */
const MAX_SUMMARY_LENGTH = 280;
const CHARS_PER_TOKEN = 4;

/** Path (relative to repoPath) of the unified `memory` config block's home. */
const LOOP_CONFIG_PATH = [".claude", "loop.json"];

export interface InjectRecallOptions {
  repoPath: string;
  /** Scope recall to one agent (entries with no agent apply to everyone). */
  agent?: string;
  /** Scope recall to entries carrying at least one of these tags. */
  tags?: string[];
  /**
   * Scope recall to one or more projects (comma-list = OR, per FEAT-423).
   * When omitted, falls back to the configured `memory.project` in
   * `.claude/loop.json`. Only reaches the wire when the configured provider
   * is astramem and paired — see the file header.
   */
  project?: string | string[];
  /**
   * Raw `memory` config block. When omitted, loaded from
   * `<repoPath>/.claude/loop.json`'s top-level `memory` key.
   */
  rawConfig?: unknown;
}

/**
 * Load the top-level `memory` block from `<repoPath>/.claude/loop.json`.
 * Never throws — missing file, malformed JSON, or a missing `memory` key
 * all resolve to `undefined` (parseMemoryConfig treats that as provider:none).
 */
export async function loadMemoryConfig(repoPath: string): Promise<unknown> {
  try {
    const targetPath = path.join(repoPath, ...LOOP_CONFIG_PATH);
    const content = await fs.readFile(targetPath, "utf8");
    const parsed = JSON.parse(content) as Record<string, unknown>;
    return parsed["memory"];
  } catch {
    return undefined;
  }
}

/** Format one recalled entry as one Markdown line. */
function formatEntry(entry: MemoryEntry): string {
  const label = `[${entry.kind} ${entry.severity}]`;
  const origin = entry.source ? `${entry.source} ` : "";
  return `- **${label}** ${origin}${entry.summary}`;
}

/**
 * Format recalled entries into the shared `## Prior context (from astramem)`
 * block. Empty input -> empty string (no header, no injected whitespace) so
 * callers can `if (!block)` cheaply.
 */
export function formatRecallBlock(entries: MemoryEntry[]): string {
  if (entries.length === 0) return "";
  const lines = entries.map(formatEntry);
  return `## Prior context (from astramem)\n${lines.join("\n")}`;
}

/**
 * Best-effort mapping of astramem wire recall hits into the MemoryEntry
 * shape formatEntry() reads. RecallHit carries no timestamp/tags, so this
 * ranks by the server-provided score alone — the same degraded-fidelity
 * tradeoff astramem-provider.ts documents for its own remote passthrough
 * (that mapper is package-internal, not exported, so this is a small
 * parallel implementation reusing the exported MemoryEntrySchema for the
 * kind guard rather than duplicating its enum).
 */
function mapWireHitsToEntries(hits: RecallHit[], k: number, maxTokens: number): MemoryEntry[] {
  const sorted = [...hits].sort((a, b) => b.score - a.score).slice(0, k);
  const entries: MemoryEntry[] = [];
  let remainingBudget = maxTokens;
  for (const hit of sorted) {
    const summary = hit.text.slice(0, MAX_SUMMARY_LENGTH);
    const cost = Math.max(1, Math.ceil(summary.length / CHARS_PER_TOKEN));
    if (cost > remainingBudget) break;
    remainingBudget -= cost;
    const kindResult = MemoryEntrySchema.shape.kind.safeParse(hit.type);
    entries.push({
      id: hit.id,
      ts: new Date().toISOString(),
      kind: kindResult.success ? kindResult.data : "lesson",
      severity: "medium",
      tags: [],
      summary,
      source: hit.source ?? "astramem"
    });
  }
  return entries;
}

/**
 * Attempt a project-scoped recall directly against the astramem wire
 * provider (bypasses the generic MemoryProvider.recall() contract, which
 * has no project field — see file header). Resolves `null` (never throws)
 * when astramem is unpaired or the call fails for any reason, signalling
 * the caller to fall back to the standard agent/tag-scoped path.
 */
async function tryProjectScopedRecall(
  opts: InjectRecallOptions,
  effective: EffectiveMemoryConfig,
  project: string | string[]
): Promise<MemoryEntry[] | null> {
  try {
    const remote = await resolveAstramemRemote();
    if (!remote) return null;
    const query = opts.tags?.join(" ") || opts.agent || "recent";
    const res = await remote.provider.recall({
      query,
      k: effective.recall.k,
      project,
      ...(opts.agent !== undefined ? { agent: opts.agent } : {})
    });
    return mapWireHitsToEntries(res.hits, effective.recall.k, effective.recall.maxTokens);
  } catch {
    return null;
  }
}

/**
 * Resolve the configured provider and recall entries scoped by agent/tags
 * (and, when astramem is paired, project) within the configured token
 * budget. Returns `[]` when memory/recall is disabled, no entries match, or
 * anything fails — same fail-silent contract as `buildRecallBlock`, just
 * without the formatting step.
 *
 * Extracted from `buildRecallBlock`'s body (additive — `buildRecallBlock`'s
 * own signature/behavior/format is unchanged, see the frozen contract at
 * `docs/contracts/recall-injection-v1.md`) so a second caller that needs the
 * raw, id-carrying entries (the dispatch-memory-credit-loop digest — see
 * `handoff-digest.ts`) doesn't have to re-implement provider resolution or
 * fork a second recall path.
 */
export async function recallEntries(opts: InjectRecallOptions): Promise<MemoryEntry[]> {
  try {
    const rawConfig =
      opts.rawConfig !== undefined ? opts.rawConfig : await loadMemoryConfig(opts.repoPath);
    const config = parseMemoryConfig(rawConfig);
    const effective = resolveEffectiveConfig(config);
    if (!effective.recallEnabled) return [];

    const project = opts.project ?? effective.project;
    if (effective.provider === "astramem" && project !== undefined) {
      const scoped = await tryProjectScopedRecall(opts, effective, project);
      if (scoped !== null) return scoped;
    }

    const provider = resolveProvider(rawConfig, opts.repoPath);
    return await provider.recall({
      ...(opts.agent !== undefined ? { agent: opts.agent } : {}),
      ...(opts.tags !== undefined ? { tags: opts.tags } : {}),
      k: effective.recall.k,
      maxTokens: effective.recall.maxTokens
    });
  } catch {
    // Best-effort: recall must never block or alter dispatch beyond
    // returning no entries.
    return [];
  }
}

/**
 * Resolve the configured provider, recall entries scoped by agent/tags
 * (and, when astramem is paired, project) within the configured token
 * budget, and format them. Returns "" when memory/recall is disabled, no
 * entries match, or anything fails.
 */
export async function buildRecallBlock(opts: InjectRecallOptions): Promise<string> {
  return formatRecallBlock(await recallEntries(opts));
}

/**
 * Recall-and-append: builds the recall block (see buildRecallBlock) and
 * appends it to `dispatchText`. GIVEN `provider:none` or
 * `recall.enabled:false` (or any failure), returns `dispatchText`
 * byte-identical/unchanged — the highest-risk regression property this
 * helper must hold.
 */
export async function injectRecall(
  dispatchText: string,
  opts: InjectRecallOptions
): Promise<string> {
  const block = await buildRecallBlock(opts);
  if (!block) return dispatchText;
  return `${dispatchText}\n\n${block}`;
}
