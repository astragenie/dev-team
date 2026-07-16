// scripts/lib/memory/handoff-digest.ts — dispatch-time memory credit-loop
// digest (upstream ask: runner-plugin
// docs/upstream-requests/2026-07-16-crew-dispatch-memory-credit-loop.md).
//
// Extends the EXISTING agent-profile-load-feedback seam
// (inject-profile.ts's buildProfileBlock, hook-fired by
// hooks/subagent-start-profile.ts on every dispatch) rather than adding a
// parallel injection path. Two components, both id-carrying:
//
//   1. agent_profile (corrections first, then decisions, then lessons) —
//      delegated verbatim to buildProfileBlock. Governed by the EXISTING
//      memory.profile.* config; behavior here is byte-identical to calling
//      buildProfileBlock directly.
//   2. recall_memory hits (k<=5, project+agent scoped), NEWLY carrying an
//      atom-id marker on each line (the frozen recall-injection-v1.md block
//      format does not carry ids and is NOT changed by this file — see
//      docs/contracts/dispatch-memory-credit-loop-v1.md for why this is a
//      sibling block, not an in-place edit to that frozen contract).
//
// Component 2 (and therefore this module's only new behavior) is gated by
// its OWN kill-switch, `memory.feedback.creditLoop.enabled` (default false,
// opt-in like every other memory sub-feature), independent of
// memory.profile.*. Nested under `memory.feedback` rather than a bare new
// top-level `memory.creditLoop` key because `@astragenie/memory-provider`'s
// MemoryConfigSchema is `.strict()` at the top level — only `profile` and
// `feedback` are declared passthrough extension namespaces; a new top-level
// key throws inside parseMemoryConfig (see parseCreditLoopConfig below). The
// GLOBAL `memory.enabled: "never"` switch always wins regardless of
// creditLoop.enabled (inherited transitively: recallEntries()/
// buildProfileBlock() both already gate on resolveEffectiveConfig()).
//
// Fail-silent throughout: any config/provider error resolves to
// `{ block: "", ids: [] }` for the recall half and whatever buildProfileBlock
// already guarantees for the profile half — never a throw, never a partial
// block.
import { loadMemoryConfig, recallEntries } from "./inject-recall.ts";
import { atomMarker, buildProfileBlock } from "./inject-profile.ts";
import type { ProfileCapableProvider } from "./profile-types.ts";
import type { MemoryEntry } from "@astragenie/memory-provider";

/** Hard ceiling regardless of config — the upstream ask fixes k<=5. */
const MAX_DIGEST_K = 5;

export interface CreditLoopConfig {
  enabled: boolean;
  /** Recall hits to include in the digest; hard-capped at MAX_DIGEST_K. */
  k: number;
}

const CREDIT_LOOP_DEFAULTS: CreditLoopConfig = {
  enabled: false,
  k: MAX_DIGEST_K
};

function num(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

/**
 * Parse the `memory.feedback.creditLoop.*` block. Disabled-by-default:
 * absent/malformed `memory`, `feedback`, or `creditLoop` resolves to safe
 * defaults with `enabled: false`. Never throws.
 *
 * Nested under `memory.feedback` (NOT a new top-level `memory.creditLoop`
 * key): `@astragenie/memory-provider`'s `MemoryConfigSchema` is `.strict()`
 * at the top level — only `profile` and `feedback` are declared as
 * `z.object({}).passthrough()` consumer-extension namespaces. A bare new
 * top-level key throws inside `parseMemoryConfig`, which every caller here
 * (recallEntries, resolveProvider) swallows via its own fail-silent
 * contract — so the bug would have been silent (digest always empty, never
 * an error) rather than loud. Crediting is the closer semantic fit to
 * `feedback` (submitOutcomeFeedback's sibling) than to `profile` anyway.
 */
export function parseCreditLoopConfig(rawMemory: unknown): CreditLoopConfig {
  if (typeof rawMemory !== "object" || rawMemory === null) return { ...CREDIT_LOOP_DEFAULTS };
  const feedback = (rawMemory as Record<string, unknown>).feedback;
  if (typeof feedback !== "object" || feedback === null) return { ...CREDIT_LOOP_DEFAULTS };
  const c = (feedback as Record<string, unknown>).creditLoop;
  if (typeof c !== "object" || c === null) return { ...CREDIT_LOOP_DEFAULTS };
  const o = c as Record<string, unknown>;
  return {
    enabled: o.enabled === true,
    k: Math.min(MAX_DIGEST_K, num(o.k, CREDIT_LOOP_DEFAULTS.k))
  };
}

/** One recall entry rendered with a trailing atom-id marker, matching the
 *  profile block's `atomMarker()` convention so both halves of the digest
 *  are machine-readable the same way. Sibling of formatRecallBlock's
 *  formatEntry — deliberately NOT exported from inject-recall.ts (that
 *  module's block format is frozen; see file header). */
function formatDigestEntry(entry: MemoryEntry): string {
  const label = `[${entry.kind} ${entry.severity}]`;
  const origin = entry.source ? `${entry.source} ` : "";
  return `- **${label}** ${origin}${entry.summary}${atomMarker(entry.id)}`;
}

/** Distinct header from the frozen `## Prior context (from astramem)` block
 *  — this is a sibling digest, not a replacement, so it must never be
 *  confused with (or double-render alongside a differently-shaped version
 *  of) the existing recall block a dispatch site already appended. */
function formatRecallDigestBlock(entries: MemoryEntry[]): string {
  if (entries.length === 0) return "";
  const lines = entries.map(formatDigestEntry);
  return `## Recall (memory credit loop)\n${lines.join("\n")}`;
}

export interface BuildHandoffDigestOptions {
  repoPath: string;
  agent: string;
  /** Scope recall to one or more projects; falls back to memory.project. */
  project?: string | string[];
  /** Raw `memory` config; when omitted, loaded from <repoPath>/.claude/loop.json. */
  rawConfig?: unknown;
  /** Test seam — forwarded verbatim to buildProfileBlock's own `provider`
   *  override. The recall half has no equivalent override; tests exercise
   *  it the same way inject-recall.ts's own tests do (provider:"file" +
   *  fileProvider capture, or the astramem-client `_setWireProvider` seam). */
  provider?: ProfileCapableProvider;
}

export interface HandoffDigest {
  /** Combined profile + recall-digest block text; "" when both are empty. */
  block: string;
  /** Every atom id present in the digest text — corrections/decisions/
   *  lessons ids from the profile half, plus recall-hit ids from the digest
   *  half. A specialist that relied on one of these can echo it back via the
   *  optional `memories_used` handoff field (see
   *  docs/contracts/dispatch-memory-credit-loop-v1.md). */
  ids: string[];
}

/**
 * Assemble the combined dispatch-time digest. When `memory.creditLoop.enabled`
 * is false (default), this is BYTE-IDENTICAL to calling `buildProfileBlock`
 * directly — the recall-digest half is entirely absent, not just empty text.
 */
export async function buildHandoffDigest(opts: BuildHandoffDigestOptions): Promise<HandoffDigest> {
  const rawConfig =
    opts.rawConfig !== undefined ? opts.rawConfig : await loadMemoryConfig(opts.repoPath);

  const { block: profileBlock, injectedIds: profileIds } = await buildProfileBlock({
    repoPath: opts.repoPath,
    agent: opts.agent,
    rawConfig,
    ...(opts.provider !== undefined ? { provider: opts.provider } : {})
  });

  const creditCfg = parseCreditLoopConfig(rawConfig);
  if (!creditCfg.enabled) {
    return { block: profileBlock, ids: profileIds };
  }

  let recallBlock = "";
  let recallIds: string[] = [];
  try {
    const entries = await recallEntries({
      repoPath: opts.repoPath,
      agent: opts.agent,
      ...(opts.project !== undefined ? { project: opts.project } : {}),
      rawConfig
    });
    const capped = entries.slice(0, creditCfg.k);
    recallIds = capped.map((e) => e.id);
    recallBlock = formatRecallDigestBlock(capped);
  } catch {
    // Fail-silent: recall half omitted, profile half (already resolved
    // above) is unaffected.
  }

  const block = [profileBlock, recallBlock].filter(Boolean).join("\n\n");
  return { block, ids: [...profileIds, ...recallIds] };
}
