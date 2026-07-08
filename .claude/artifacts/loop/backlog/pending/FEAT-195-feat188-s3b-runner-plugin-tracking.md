---
id: FEAT-195
status: pending
priority: P1
category: platform
target_release: null
created: 2026-07-08
depends_on: [FEAT-188]
slices: [S3b]
derived_from: .claude/artifacts/loop/backlog/in-progress/FEAT-188-memory-provider-capture-recall.md
pm_customer_impact: 0.70
pm_effort_estimate: 0.30
pm_strategic_alignment: 0.80
pm_technical_risk: 0.35
pm_dependency_depth: 0.20
composite_score: 0.66
autonomous_safe: false
tags: ["stack:typescript", "surface:plugin", "concern:memory", "concern:dispatch", "cross-repo", "runner-plugin"]
triage_notes: |
  Cross-repo tracking ticket. FEAT-188 (MemoryProvider capture/recall) is COMPLETE on the
  dev-team side — all six dev-team slices (S1a, S2, S3a, S4, S5, S6) merged to main, no open
  PRs. FEAT-188 stays in-progress ONLY because its last slice, S3b (recall injection at
  runner-plugin dispatch sites), lives in the runner-plugin repo. This ticket exists so the
  remaining work is visible from the dev-team backlog and carries the exact adoption checklist,
  rather than being invisible behind a sibling-repo issue number.

  MUST be built in a runner-plugin session/worktree (cross-repo edits require worktree —
  never branch/edit runner-plugin from a dev-team checkout). autonomous_safe=false: touches
  the runner dispatch/slice-start path (prompt-adjacent, human-in-loop review).
---

# FEAT-195: FEAT-188 S3b — recall injection at runner-plugin dispatch sites (cross-repo tracking)

## Current state (2026-07-08)

- **dev-team FEAT-188 is done on this side.** Slices merged to `main`:
  - S1a `a5a1517b`, S2 `bad4dd89`, S3a `4d5f580e`, S4 `4e43fc44`, S5 `79bc2e44`, S6 `7c810059`.
  - Full suite green on merged main (1715 pass / 0 fail / 117 skip); lint clean.
  - No open dev-team PRs (`gh pr list` = `[]`). Nothing to merge here.
- **Runner-plugin S1b already shipped** — `f2803af9` (runner-plugin#361).
- **Remaining: S3b only** — recall injection at runner-plugin dispatch sites. Tracked as
  runner-plugin#368 (actionable spec, filed 2026-07-08) / #358 / #363. Until it lands, FEAT-188 stays `in-progress`.
- **The cross-repo contract is FROZEN and ready to consume:** `docs/contracts/recall-injection-v1.md`
  (dev-team commit `4bcf33d8`, "freeze recall-injection interface v1 → unblocks S3b"). S3a's
  helper (`scripts/lib/memory/inject-recall.ts`) is the source of the interface. Any change to
  that signature/block shape is a breaking change → v2 (bump the doc + notify runner-plugin),
  NOT an in-place edit.
- **This does NOT block a dev-team release.** v0.54.0 can ship now with FEAT-188's dev-team half;
  S3b closes in runner-plugin on its own cadence. Note it in release notes so FEAT-188 showing
  P1/in-progress is not misread as unfinished dev-team work.

## What runner-plugin must do (S3b)

Build in a **runner-plugin session/worktree** against the frozen v1 contract.

1. **Consume the frozen helper at runner dispatch sites.** Import `injectRecall` /
   `buildRecallBlock` from S3a's `scripts/lib/memory/inject-recall.ts` — or, if importing across
   the plugin boundary isn't viable, replicate the frozen block format **exactly** (do NOT fork a
   second recall-block format). Wire it into the wave runner + confirm the vendored consumer
   applies S3a's emitted `memory` field at the **live dispatch call** (`dispatch.mts` is a pure
   plan generator — it only emits the shape; the runtime consumer must apply it).
2. **Retire the bridge's own `runRecallHook`** (`start-slice.mts:450`) and route slice-start
   recall through the unified helper, so there is exactly **one** injection per dispatch. Today
   two sites can inject: `runRecallHook` @ `start-slice.mts:450` and `buildMemoryContext` @
   `post-builder-fanout.mts:97` — retiring/routing prevents double-injection.
3. **Preserve the frozen invariants** (S3b relies on them):
   - Best-effort, never throws — config/provider/timeout error → omit block, never alter dispatch.
   - Byte-identical when off — `provider:none` or `recall.enabled:false` → dispatch unchanged.
   - Empty → `""` (no header, no injected whitespace).
   - Scoping via `agent`/`tags`; `k` + `maxTokens` from resolved `recall.*` bound the result.
   - Shared header `## Prior context (from astramem)`, one Markdown line per entry:
     `- **[<kind> <severity>]** <source? + " "><summary>`.
4. **Transport stays MCP/plugin-provider** per DEC dev-team#172 — no CLI-shell `resolveCli()`,
   no hand-rolled HTTP client. S1b/S3b (#357/#358) already framed MCP-only.

## Acceptance criteria (S3b — mirrors FEAT-188 §S3a/S3b)

- GIVEN any runner dispatch-assembly site builds an instruction with memory configured, WHEN
  assembled, THEN a recall block is injected (one line per entry, scoped by agent/tags,
  ≤ `recall.maxTokens`), reusing the frozen v1 block format — not a second parallel format.
- GIVEN `provider:none` or `recall.enabled:false`, WHEN assembled, THEN dispatch output is
  byte-identical to today (golden dispatch-trace test).
- GIVEN S3b ships, WHEN a slice starts, THEN recall is injected **exactly once** — the bridge's
  own `runRecallHook` is retired/routed through the unified helper (no double-injection with
  `buildMemoryContext`).
- GIVEN a new runner dispatch-assembly path added without the helper, WHEN the completeness
  fitness test runs, THEN it fails.

## On completion (closes FEAT-188)

When S3b merges to runner-plugin `main`:
1. In runner-plugin: close #358 / #363, run its slice-close ceremony.
2. In dev-team: update `FEAT-188-*.md` `slices_remaining: []`, add an S3b-landed progress note
   (commit ref), run `/runner:close` / slice-close to move FEAT-188 → `done/`, and close this
   FEAT-195 tracking ticket in the same pass.

## Refs

- `docs/contracts/recall-injection-v1.md` (frozen v1 interface — S3b's input).
- `.claude/artifacts/loop/backlog/in-progress/FEAT-188-memory-provider-capture-recall.md` (parent; §S3b + dependency order).
- dev-team#173 (decision #3), dev-team#172 (transport = MCP).
- runner-plugin#358 (S3b), #363 (tracking), #361/`f2803af9` (S1b landed), #324 (bridge staleness).
- `docs/research/2026-07-06-memory-bridge-reconciliation.md`.
- Memory [[cross-repo-edits-require-worktree]], [[astramem-live-v06-interface]].
