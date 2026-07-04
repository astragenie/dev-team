---
id: SLICE-111
parent: FEAT-186
status: done
priority: P2
created: 2026-07-01
title: "FEAT-186 S2 — dailyCapMeter ingests JudgeCost from both pipelines"
stack: typescript
autonomous_safe: false
est_days: 2
depends_on: [SLICE-110]
touches_files:
  - gepa-core/src/budget/daily-cap-meter.ts
  - gepa-core/tests/daily-cap-cross-pipeline.test.ts
  - evals/lib/judge.ts
  - evals/cli.ts
---

# SLICE-111: FEAT-186 S2 — dailyCapMeter cross-pipeline ingestion

## Source

FEAT-186 `proposed_slices` S2 (2026-06-29 pm-decompose). Materialized 2026-07-01 for parallel dispatch with SLICE-112 after SLICE-110 publishes.

## Scope

Update gepa-core `dailyCapMeter.record(cost: JudgeCost)` to accept the canonical shape from both emission points:

- **evals pipeline**: `evals/cli.ts` and `evals/lib/judge.ts` import `dailyCapMeter` from `@astragenie/gepa-core` and call `.record()` after each judge evaluation.
- **gepa pipeline**: FEAT-183 SLICE-97 capture tee already writes cost into JSONL — this slice wires the meter call in the same code path (verify no double-count).

**Cost INGESTION only** — TTL/reserve/release flow stays deferred to a sibling FEAT once gepa-core S5 (full budget meter) lands per FEAT-186 body §Risks (spec line 326-333).

No new exports beyond what SLICE-110 published.

## Acceptance criteria

**AC-1:** `dailyCapMeter.record(cost: JudgeCost)` accepts the canonical shape. Type signature widens to accept `JudgeCost` (no longer accepts a bare number).

**AC-2 (cross-pipeline budget enforcement):** Configure `$1/day` cap. Spend `$0.60` via `evals/cli.ts` judge call + `$0.50` via gepa Trial → third call across either pipeline blocks. Test lives in `gepa-core/tests/daily-cap-cross-pipeline.test.ts` using a shared in-memory meter instance.

**AC-3 (no double-count):** SLICE-97 capture tee currently only writes JSONL, not meter. Builder MUST grep `dailyCapMeter.record` in `astragenie/gepa-core` + `astragenie/dev-team` before wiring; add idempotency assertion (same `trial_id` recorded twice is a no-op).

**AC-4 (dev-team integration):** `evals/lib/judge.ts` imports `dailyCapMeter` from `@astragenie/gepa-core` and calls `.record()` in the evaluation code path. `evals/cli.ts` cost-attribution output unchanged byte-for-byte for fixture replays.

**AC-5:** `bun test` green on both gepa-core and dev-team. `bun run e2e:smoke` unchanged.

## Risks

- **Double-count risk**: SLICE-97 capture tee may already record cost into meter. Current evidence: only JSONL write, no meter call — but a builder MUST re-verify with `rg "dailyCapMeter\.record"` across gepa-core src before wiring. Mitigation: AC-3 idempotency assertion + pre-wire grep gate.
- **In-memory only**: `dailyCapMeter` is currently in-memory. Pipeline-crossing requires same process. Out-of-process daily caps stay deferred to sibling FEAT. Cross-process test = false confidence.
- **SLICE-110 gate**: dev-team `evals/lib/judge.ts` must import from `@astragenie/gepa-core@^0.6.0` — SLICE-110 publish is a hard prereq.

## Out of scope (deferred)

- TTL / reserve / release flow — sibling FEAT once gepa-core S5 (budget) lands.
- Out-of-process daily-cap enforcement — separate FEAT if surfaced.
- Renderer changes — SLICE-112.

## Dispatch notes

- Autonomous_safe=false: touches both packages, imports across plugin boundary. Human review at handoff mandatory.
- Cross-repo: gepa-core + dev-team both edited. Two PRs (one per repo), gepa-core first for shim publish.
- Parallel with SLICE-112: no file overlap (S2 = budget dir + evals; S3 = scripts/lib/cost + fixtures). Sibling worktrees safe.
