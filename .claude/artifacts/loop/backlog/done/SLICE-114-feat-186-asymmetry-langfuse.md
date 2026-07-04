---
id: SLICE-114
parent: FEAT-186
status: triaged
priority: P2
created: 2026-07-01
title: "FEAT-186 S5 — asymmetry heuristic + Langfuse single-trace emission (dev-team scope)"
stack: typescript
autonomous_safe: false
est_days: 2
depends_on: [SLICE-112]
touches_files:
  - scripts/lib/cost/asymmetry-detector.ts
  - scripts/lib/cost/asymmetry-detector.test.ts
  - evals/lib/langfuse-emitter.ts
  - tests/fixtures/cost-asymmetry/
---

# SLICE-114: FEAT-186 S5 — cost asymmetry heuristic + Langfuse single-trace emission

## Source

FEAT-186 `proposed_slices` S5 (2026-06-29 pm-decompose). Materialized 2026-07-01 for parallel dispatch with SLICE-113. **Scope revised**: gepa-core side of Langfuse emission (`packages/gepa-core/src/observability/langfuse-trace.ts`) deferred to a sibling FEAT — this slice covers dev-team consumers only.

## Scope

### Part A — asymmetry heuristic

Add cross-pipeline asymmetry warning surfaced in the slice cost report when one pipeline's judge-cost is >10× the other's for the same slice. **Warning text only** — no auto-fail, no exit-code change, no CI gate.

- New module: `scripts/lib/cost/asymmetry-detector.ts` — `detectAsymmetry(entries: CostEntry[]): AsymmetryFinding[]`.
- Absolute-floor guard: skip warning if total delta < $0.10 (avoids 12× on $0.001 vs $0.012 tripping noise).
- Provide the finding as data (structured object); caller decides whether to append to the report or log.

### Part B — Langfuse single-trace emission (dev-team side)

Extend `evals/lib/langfuse-emitter.ts` (from FEAT-169 SLICE-90) so one judge `evaluate()` call = one Langfuse trace regardless of pipeline. Both pipelines consume the same `JudgeCost` shape from `@astragenie/gepa-core@0.5.0`.

- No new transport dependencies — extend existing FEAT-169 Langfuse emitter.
- Do not touch `packages/gepa-core/src/observability/langfuse-trace.ts` — that's a sibling FEAT (would need a gepa-core 0.6.0 publish cycle).

## Acceptance criteria

**AC-1 (asymmetry detection, warning-only):** `detectAsymmetry` returns findings when per-slice cost ratio between pipelines exceeds 10× AND absolute delta exceeds $0.10. Fixture: `(gepa=$0.50, eval=$0.04)` → warning; `(gepa=$0.10, eval=$0.08)` → no warning; `(gepa=$0.001, eval=$0.012)` → **no warning** (absolute-floor guard).

**AC-2 (no auto-fail):** `detectAsymmetry` returns findings; consumer decides. No `throw`, no `process.exit`, no CI gate wired.

**AC-3 (Langfuse single trace):** For each `LLMJudge.evaluate()` call across either pipeline, verify a single Langfuse trace is emitted with a consistent `trace_id` schema. Test asserts trace count equals evaluate-call count on a fixture mix.

**AC-4 (JudgeCost consumption):** Both modules consume `JudgeCost` type from `@astragenie/gepa-core@^0.5.0` (already installed). No duplicate cost-shape definition.

**AC-5 (gates):** `bun run lint` zero warnings, `bun run typecheck` clean, `bun run format:check` clean, `bun test scripts/lib/cost/asymmetry-detector.test.ts` slice tests green. Baseline full-suite must not regress.

## Risks

- **10× threshold noise on tiny denominators.** Mitigation: absolute-floor of $0.10 in AC-1.
- **Langfuse SDK version drift.** Mitigation: pin Langfuse SDK version alongside existing FEAT-169 emitter. Do not change the SDK version without a separate slice.
- **gepa-core observability side NOT in scope.** Explicitly deferred — if the reviewer flags that gepa-core's Trial emission ALSO needs to route through the same trace, note it as a sibling FEAT and do NOT expand this slice's scope.

## Out of scope (deferred)

- **`packages/gepa-core/src/observability/langfuse-trace.ts`** — sibling FEAT, needs a gepa-core 0.6.0 publish cycle.
- **Threshold retuning based on real data.** Ship warning-only at 10×; retune after ≥5 weeks of real corpora per FEAT-186 risk note.
- **SLICE-113 (S4 brief-me reader)** — dispatched separately.

## Dispatch notes

- Autonomous_safe=false: warning-only heuristic + Langfuse emission touching FEAT-169 code.
- Single-repo (dev-team). Zero cross-plugin coordination.
- Parallel-safe with SLICE-113 (no file overlap: S5 = `scripts/lib/cost/asymmetry-detector.ts` + `evals/lib/langfuse-emitter.ts`, S4 = `scripts/lib/brief-me/`).
