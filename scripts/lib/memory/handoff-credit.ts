// scripts/lib/memory/handoff-credit.ts — orchestrator-side crediting for the
// OPTIONAL `memories_used` handoff field (dispatch-memory-credit-loop,
// runner-plugin upstream request 2026-07-16).
//
// Settled lesson (see docs/superpowers/specs/2026-07-14-agent-profile-load-
// feedback-design.md + the upstream request doc): voluntary subagent
// crediting via `submit_feedback` (skills/universal/using-memory/SKILL.md
// Step 3) measured ~0.7% credited-over-served on the live daemon. This path
// is orchestrator-enforced instead: the PARENT thread (warm MCP/provider
// connection — a fresh subagent's connection would hit astramem-local#343's
// cold-start timeout) reads the ids a specialist reported it relied on and
// credits them directly. The subagent never calls feedback itself here.
//
// Fail-silent + bounded throughout: a daemon error/timeout/missing
// feedback() method must never block, delay, or fail the write-handoff /
// report-to-pr call this rides on. Never validated, never gated — an absent
// or malformed `memories_used` credits nothing and is not an error.
import { loadMemoryConfig } from "./inject-recall.ts";
import { parseCreditLoopConfig } from "./handoff-digest.ts";
import type { ProfileCapableProvider } from "./profile-types.ts";

/** Hard ceiling on ids credited per call — a misbehaving/adversarial report
 *  listing hundreds of ids must not turn into an unbounded fan-out of
 *  feedback calls. Generous enough for any real handoff (a digest caps at
 *  <=15 ids: <=10 profile + <=5 recall). */
const MAX_CREDIT_BATCH = 20;

export interface CreditMemoriesUsedOptions {
  repoPath: string;
  /** Raw ids as reported in the handoff's optional `memories_used` field.
   *  Non-string / empty entries are silently dropped; never throws on
   *  malformed input. */
  ids: ReadonlyArray<unknown> | undefined;
  rawConfig?: unknown;
  /** Test seam / explicit provider; when omitted, resolveProvider() is used. */
  provider?: ProfileCapableProvider;
}

function sanitizeIds(ids: ReadonlyArray<unknown> | undefined): string[] {
  if (!Array.isArray(ids)) return [];
  const cleaned = ids.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
  return Array.from(new Set(cleaned)).slice(0, MAX_CREDIT_BATCH);
}

/**
 * Credit every id in a specialist's self-reported `memories_used` list via
 * the resolved provider's `feedback(id, { used: true })`. Gated by
 * `memory.feedback.creditLoop.enabled` (default false — same switch that
 * gates the recall half of the dispatch digest, see handoff-digest.ts) ON
 * TOP OF the global `memory.enabled: "never"` kill-switch (inherited: a
 * `provider:none`/`enabled:"never"` config resolves resolveProvider() to a
 * noop provider with no `feedback()` method — see @astragenie/
 * memory-provider's own gating — so this never needs to duplicate that
 * check here beyond the dedicated creditLoop flag).
 *
 * Absent/empty/malformed `ids` -> `{ credited: [] }`, no-op. Any per-id or
 * whole-call failure is swallowed silently — never throws, never blocks the
 * caller (write-handoff / report-to-pr) from completing.
 */
export async function creditMemoriesUsed(
  opts: CreditMemoriesUsedOptions
): Promise<{ credited: string[] }> {
  const empty = { credited: [] as string[] };
  try {
    const ids = sanitizeIds(opts.ids);
    if (ids.length === 0) return empty;

    const rawConfig =
      opts.rawConfig !== undefined ? opts.rawConfig : await loadMemoryConfig(opts.repoPath);
    const creditCfg = parseCreditLoopConfig(rawConfig);
    if (!creditCfg.enabled) return empty;

    let provider = opts.provider;
    if (!provider) {
      const { resolveProvider } = await import("@astragenie/memory-provider");
      provider = resolveProvider(rawConfig, opts.repoPath) as unknown as ProfileCapableProvider;
    }
    if (typeof provider.feedback !== "function") return empty;

    const credited: string[] = [];
    for (const id of ids) {
      try {
        const ok = await provider.feedback(id, { used: true });
        if (ok) credited.push(id);
      } catch {
        /* per-id fail-silent */
      }
    }
    return { credited };
  } catch {
    return empty;
  }
}
