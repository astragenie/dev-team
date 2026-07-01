---
id: SLICE-113
parent: FEAT-186
status: triaged
priority: P2
created: 2026-07-01
title: "FEAT-186 S4 — brief-me cost-aggregator consumes unified renderer shape"
stack: typescript
autonomous_safe: false
est_days: 1
depends_on: [SLICE-112]
touches_files:
  - scripts/lib/brief-me/cost-aggregator.ts
  - scripts/lib/brief-me/cost-aggregator.test.ts
  - tests/fixtures/brief-me/multi-slice-cost-corpus/
---

# SLICE-113: FEAT-186 S4 — brief-me cost-table reader consumes unified shape

## Source

FEAT-186 `proposed_slices` S4 (2026-06-29 pm-decompose). Materialized 2026-07-01 after SLICE-112 renderer landed via PR #139.

## Scope

Update `scripts/lib/brief-me/cost-aggregator.ts` to read the unified per-slice cost reports produced by `renderCostReport` from `scripts/lib/cost/cost-report-renderer.ts` (SLICE-112).

- Drop any per-pipeline column doubling in the aggregation.
- Preserve backward-compat: reports written under the pre-186 shape continue to aggregate correctly (degenerate single-row case).
- Assertion test: brief-me aggregated total equals sum of per-slice report totals to the cent across a fixture set of 3+ slices spanning eval-only / gepa-only / dual-pipeline.
- No UI changes beyond removing duplicate columns.

## Acceptance criteria

**AC-1 (unified consumption):** `cost-aggregator.ts` calls into or reuses `CostEntry` typing from `scripts/lib/cost/cost-report-renderer.ts`. No parallel type definition for the aggregation shape.

**AC-2 (cent-precision total assertion):** Given a fixture set of 3+ slices (mix of eval-only, gepa-only, dual-pipeline), the aggregated `total_usd` matches the sum of per-slice `usd` values to the cent. Rounding convention: banker's rounding to 4 decimal places before sum, then 2 for display (per FEAT-159 SLICE-85 if applicable — otherwise document the chosen rule in a comment on the aggregator).

**AC-3 (no per-pipeline doubling):** Compare brief-me output pre/post migration. Any duplicated `(eval, gepa)` per-pipeline columns collapse into the unified `(pipeline, provider)` shape.

**AC-4 (backward-compat):** Pre-186 cost report artifacts under `.claude/artifacts/crew/cost/` (real on-disk fixtures — NOT synthetic) aggregate without crash.

**AC-5 (gates):** `bun run lint` zero warnings, `bun run typecheck` clean, `bun run format:check` clean, `bun test scripts/lib/brief-me/` slice tests green. Baseline full-suite must not regress.

## Risks

- **Cent-precision assertion is non-trivial across floating-point USD totals.** Mitigation: banker's rounding rule locked in the aggregator + explicit test with a mixed corpus that would fail under naive rounding.
- **brief-me currently reads from stale cached aggregate?** Verify the read path before assuming this is a pure swap. If a cache layer exists, invalidate it on cost-report change.
- **SLICE-112 renderer contract stability:** `CostEntry` shape must not change without coordinating with this slice. If it does, SLICE-113 gets caught in double-migration.

## Out of scope (deferred)

- **SLICE-114 (S5 asymmetry + Langfuse)** — dispatched separately.
- **Cost-report renderer changes** — SLICE-112, already landed.
- **Historical rollups (weekly/monthly)** — `loop:retrospective` skill scope, no work here.

## Dispatch notes

- Autonomous_safe=false: brief-me is user-visible surface — layout regressions land quickly.
- Single-repo (dev-team). No cross-plugin coordination.
- Parallel-safe with SLICE-114 (no file overlap: S4 = `scripts/lib/brief-me/`, S5 = `scripts/lib/cost/asymmetry-detector.ts` + `evals/lib/langfuse-emitter.ts`).
