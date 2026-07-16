# Dispatch-time memory credit loop — v1

- **Status:** v1 · **Source:** `scripts/lib/memory/handoff-digest.ts`,
  `scripts/lib/memory/handoff-credit.ts`
- **Consumers:** the `SubagentStart` hook (`hooks/subagent-start-profile.ts`),
  the `crew profile-block` CLI fallback, `write-handoff` / `report-to-pr`.
- **Upstream ask:** runner-plugin
  `docs/upstream-requests/2026-07-16-crew-dispatch-memory-credit-loop.md`.
- **Sibling contracts:** [`recall-injection-v1.md`](./recall-injection-v1.md)
  (frozen, unchanged by this doc) and
  [`agent-profile-feedback-v1.md`](./agent-profile-feedback-v1.md) (extended
  by this doc — see "Relationship to the existing seams" below).

## Problem this closes

Crew agents were wired to astramem via the `using-memory` skill, which relies
on the subagent *voluntarily* calling `submit_feedback`. Measured on the live
daemon: 634 memories served, 4–5 credited (~0.7%). Voluntary crediting is a
dead end — the ranking signal (ADR-010's usefulness score) never accumulates
real data. This contract moves crediting to the **orchestrator**, which has a
warm MCP/provider connection and can enforce the loop without depending on a
subagent choosing to call a tool.

## What it does

1. **Dispatch-time digest.** At every subagent dispatch, the digest
   (`buildHandoffDigest`) combines:
   - `agent_profile` (corrections first, then decisions, then lessons) —
     delegated verbatim to the existing `buildProfileBlock`
     (`agent-profile-feedback-v1.md`). Governed by the existing
     `memory.profile.*` config; unaffected by this contract.
   - `recall_memory` hits (k≤5, project+agent scoped), a **new** sibling
     block — `## Recall (memory credit loop)` — with each line carrying a
     trailing `<!--atom:<id>-->` marker, the same convention
     `agent-profile-feedback-v1.md` already uses for profile atoms. This is
     deliberately a new block, not an edit to the FROZEN
     `## Prior context (from astramem)` format in `recall-injection-v1.md`
     (that contract explicitly forbids in-place format changes; runner-plugin
     depends on it staying byte-identical).
   - Both halves carry every id present into the digest's returned `ids`
     list, so a specialist can copy one into its handoff.
2. **Optional `memories_used` handoff field.** A specialist MAY report the
   ids it actually relied on:
   - `write-handoff --memories-used <csv>` (architect, document-writer,
     researcher, and other agents that call `write-handoff` directly).
   - `report-to-pr.ts --memories-used <csv>` (builder-tier agents —
     fullstack-dev/backend-dev/frontend-dev — that report via the PR-comment
     contract instead of `write-handoff`; see `report-to-pr.ts`'s header).
   - Never validated, never gated. Absent field = credit nothing. This is NOT
     a new required step in any ceremony.
3. **Credit on receipt.** Whichever surface consumed the handoff calls
   `creditMemoriesUsed`, which submits `feedback(id, { used: true })` for
   each reported id via the resolved provider. Bounded (max 20 ids per call,
   `MAX_CREDIT_BATCH`), fail-silent per id and as a whole, and — in
   `writeArtifact` — fired detached (never inline-awaited), mirroring the
   existing `fireCaptureTeeSilent`/`fireFailureCaptureSilent` fire-and-forget
   pattern. In the one-shot `report-to-pr.ts` CLI (no long-running process to
   detach into), the call is awaited but bounded by `fireGuarded`'s ~1.5s
   ceiling, so it can add latency but never hang or fail the CLI.

## Config — `.claude/loop.json` → `memory.feedback.creditLoop`

```jsonc
{
  "memory": {
    // ... existing keys (see recall-injection-v1.md / agent-profile-feedback-v1.md) ...
    "feedback": {
      "enabled": false,     // existing outcome-backstop feedback switch (unrelated)
      "mode": "outcome",    // existing
      "creditLoop": {
        "enabled": false,   // default false — opt-in, like every other memory sub-feature
        "k": 5              // recall hits in the digest; HARD-capped at 5 regardless of config
      }
    }
  }
}
```

**Why nested under `memory.feedback`, not a new top-level `memory.creditLoop`
key:** `@astragenie/memory-provider`'s `MemoryConfigSchema` is `.strict()` at
the top level — only `profile` and `feedback` are declared
`z.object({}).passthrough()` consumer-extension namespaces (the same
mechanism `memory.profile.injectVia`/`topLessons`/etc. already rely on). A
bare new top-level key throws inside `parseMemoryConfig`; because every
caller here (`recallEntries`, `resolveProvider`) already swallows that error
per its own fail-silent contract, the failure mode would have been **silent**
(digest permanently empty, no error surfaced) rather than loud. Crediting is
also the closer semantic fit to `feedback` (it IS `submitOutcomeFeedback`'s
sibling) than to `profile`.

- **`memory.feedback.creditLoop.enabled`** (boolean, default `false`): master
  switch for BOTH the recall-digest half of `buildHandoffDigest` and
  `creditMemoriesUsed`'s crediting. The profile half of the digest is
  unaffected by this flag — it keeps its own existing
  `memory.profile.enabled` gate.
- **`memory.feedback.creditLoop.k`** (number, default `5`, hard-capped at
  `5`): recall hits included in the digest. The cap is enforced in code
  (`Math.min(5, configured)`), not just documented — a misconfigured `k: 100`
  silently clamps rather than bloating the dispatch prompt.
- **Global kill-switch:** `memory.enabled: "never"` always wins, regardless
  of `creditLoop.enabled` or `profile.enabled`. Inherited transitively —
  `resolveProvider()` resolves to `noopProvider()` (no `profile()`/
  `feedback()` methods) when `captureEnabled` is false, so both halves of the
  digest and the credit call degrade to empty/no-op without any
  creditLoop-specific check needed.

## Block format (new)

```
## Recall (memory credit loop)
- **[<kind> <severity>]** <source? + " "><summary> <!--atom:<id>-->
```

- Distinct header from the frozen `## Prior context (from astramem)` block
  (`recall-injection-v1.md`) — this is a sibling digest block, never a
  replacement, and must not be confused with it.
- Empty entries → `""`, no header, no injected whitespace — same "empty
  means nothing, ever" convention as every other memory block in this repo.
- Hard-capped at `k` (≤5) entries, deterministically (`.slice(0, k)` after
  the standard recall ranking).

## `memories_used` field shape

- **`write-handoff --memories-used <csv>`** → `ArtifactFields.memoriesUsed:
  string[]`. Stored verbatim on the artifact object (not yet rendered into
  the handoff artifact's Markdown body — it exists only to drive the credit
  side-effect in `writeArtifact`).
- **`report-to-pr.ts --memories-used <csv>`** → `ReportFields.memoriesUsed:
  string[]`, rendered as a `MEMORIES: <csv>` line in the PR-comment report
  body (round-trips through `buildReportBody`/`parseReportBody`), in addition
  to driving the credit call.
- Both CLIs treat an absent or empty `--memories-used` as a complete no-op —
  byte-identical to the flag not existing.

## Invariants

1. **Byte-identical when off.** `memory.feedback.creditLoop.enabled: false`
   (default) → `buildHandoffDigest` returns exactly what `buildProfileBlock`
   alone would have returned (same block text, same ids) — the recall half
   is entirely ABSENT from the return value, not merely empty text.
2. **Never a new required step.** `memories_used` is optional in every
   handoff surface; no validator or CI gate checks for its presence.
   `dispatchInstruction`'s shape is unchanged — the digest is prepended
   prompt text, matching `recall-injection-v1.md`'s own invariant.
3. **Fail-silent + bounded throughout.** Config parse error, provider error,
   missing `profile()`/`feedback()`, a throwing provider, or a daemon
   timeout all resolve to empty block / no-op credit — never a throw, never
   a blocked/delayed dispatch or handoff-write.
4. **Global kill-switch always wins.** `memory.enabled: "never"` disables
   every touchpoint in this contract regardless of `creditLoop.enabled`.
5. **Bounded batch.** `creditMemoriesUsed` credits at most `MAX_CREDIT_BATCH`
   (20) ids per call, deduplicated, non-string/blank entries dropped
   silently — a malformed or adversarial `memories_used` list cannot turn
   into an unbounded feedback fan-out.
6. **k≤5 hard cap.** The recall-digest half never exceeds 5 entries
   regardless of configured `k` (matches the upstream ask's explicit cap).
7. **No format change to the frozen recall block.** `recall-injection-v1.md`'s
   `## Prior context (from astramem)` format, and every function it
   documents, are untouched. The additive `recallEntries()` export (factored
   out of `buildRecallBlock`'s body) preserves `buildRecallBlock`'s exact
   pre-existing signature and behavior.

## Relationship to the existing seams

- **Extends, does not replace**, the SubagentStart hook
  (`hooks/subagent-start-profile.ts` → `hooks/lib/subagent-profile-core.ts`):
  the hook's default loader now resolves `buildHandoffDigest` instead of
  `buildProfileBlock` directly. This is the most universal dispatch-assembly
  point available — it fires on every subagent dispatch, including ad-hoc
  `Agent()` calls that no `commands/*.md` flow ever sees.
- **Extends** the `crew profile-block` CLI fallback (for repos/clients
  without the hook, `memory.profile.injectVia: "command"`) the same way.
- **Complements, does not replace**, the existing outcome-backstop
  (`submitOutcomeFeedback` / `crew profile-feedback`, still fires on gate
  PASS for every profile-injected atom regardless of self-reporting). This
  contract adds a SECOND, more precise credit path driven by explicit
  self-report rather than blanket outcome-crediting.
- **Layer 2 (runner-plugin, separate work):** slice-close batch crediting,
  outcome-weighted, is runner-plugin's own follow-on (see the upstream
  request doc's "Division of labor"). The only cross-plugin coupling is the
  optional `memories_used` field's existence and shape — dev-team does not
  depend on anything runner-plugin does with it.

## Testing

- `tests/memory-handoff-digest.test.ts` — byte-identical-when-off, id-carrying
  recall block when enabled, k≤5 hard cap, global kill-switch, fail-silent on
  a recall-side config error.
- `tests/memory-handoff-credit.test.ts` — happy-path batch credit, the
  dedicated kill-switch, the global kill-switch, malformed/absent ids ignored,
  the `MAX_CREDIT_BATCH` bound, provider-without-`feedback()`, and a throwing
  `feedback()` for one id not blocking the rest.
- `tests/memory-write-handoff-credit.test.ts` — `writeArtifact`'s detached,
  bounded credit hook: fires only for `kind: "handoff"` with a non-empty
  `memoriesUsed`, never blocks the write's return even when the credit loader
  is slow.
- `tests/report-to-pr.test.ts` — `memoriesUsed` round-trip through
  `buildReportBody`/`parseReportBody`.
- `tests/subagent-profile-hook.test.ts` — the hook's default loader (no test
  override) resolves `buildHandoffDigest` without a live daemon.
