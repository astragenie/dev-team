---
id: SLICE-99
parent: FEAT-183
status: done
priority: P1
created: 2026-06-27
title: "FEAT-183 S4 — /crew:gepa-optimize fullstack-dev --artifact-only + CandidateGenerator wraps aiplugin-dev + budget cap + Pareto math + 3-cycle no-winner halt — CHECKPOINT 1"
stack: typescript + markdown
autonomous_safe: false
est_days: 3
depends_on: [SLICE-96, SLICE-97, SLICE-98]
touches_files:
  - commands/gepa-optimize.md
  - scripts/crew.ts
  - scripts/lib/gepa/optimize-runner.ts
  - scripts/lib/gepa/candidate-generator-aiplugin.ts
  - scripts/lib/gepa/no-winner-streak-tracker.ts
  - tests/gepa/optimize-artifact-only.test.ts
  - tests/gepa/optimize-budget-halt.test.ts
  - tests/gepa/optimize-no-winner-streak.test.ts
  - tests/gepa/optimize-pareto-tiebreaker.test.ts
  - tests/fixtures/gepa/synthetic-failing-trials.jsonl
---

# SLICE-99: FEAT-183 S4 — optimize artifact-only — CHECKPOINT 1

## Scope

Land Phase 3 (Optimize) end-to-end on `fullstack-dev` WITHOUT auto-PR or auto-merge — artifact-only output proves the loop works before promotion logic ships in S8a/S8b.

- `commands/gepa-optimize.md` + `/crew:gepa-optimize <agent> --k 5 --budget 5 --artifact-only` CLI subcommand wired in `scripts/crew.ts`.
- `scripts/lib/gepa/candidate-generator-aiplugin.ts` — implements `CandidateGenerator` interface by dispatching `crew:aiplugin-dev` against the current champion prompt + a sample of failing trials; returns K candidate prompt files written to `.claude/artifacts/crew/gepa/candidates/<cycle-id>/<uuid>.md`. Honors `BudgetMeter.reserve(estimateUsd)` BEFORE dispatching aiplugin-dev. Calls `validateCandidateSize` on each returned candidate BEFORE returning (oversized candidates filtered out with `pareto_rank: null` + rationale `oversized_candidate`).
- `scripts/lib/gepa/optimize-runner.ts` — wraps `runOptimization()` from the library; uses `sequentialRunner` for candidate runs (waveRunner deferred per design). Writes `OptimizationResult` to `.claude/artifacts/crew/gepa/opt/<run-id>.json`.
- `scripts/lib/gepa/no-winner-streak-tracker.ts` — persisted state at `.claude/artifacts/crew/gepa/no-winner-streak.json`; after 3 consecutive `no_winner: true` cycles on the same agent, blocks the next `/crew:gepa-optimize <agent>` until `node scripts/crew.ts gepa-resume <agent>` clears the streak.
- Four tests: `optimize-artifact-only.test.ts`, `optimize-budget-halt.test.ts`, `optimize-no-winner-streak.test.ts`, `optimize-pareto-tiebreaker.test.ts`.

This slice is **CHECKPOINT 1**: if `runOptimization` returns `no_winner` 3 times in a row on fullstack-dev with real LLM calls, the team stops and rescopes before S5a. The `no_winner_streak` event in `.claude/logs/events.jsonl` is the human signal.

## Acceptance criteria

AC-1: Given at least 10 failing trials exist in `.claude/artifacts/crew/gepa/trials/fullstack-dev.jsonl` with `source: "eval"` or `source: "captured"`, When `/crew:gepa-optimize fullstack-dev --k 5 --budget 5 --artifact-only` runs and the cycle does not hit budget cap, Then `crew:aiplugin-dev` is dispatched at least once, 5 candidate prompt files appear under `.claude/artifacts/crew/gepa/candidates/<cycle-id>/` (one per UUID), each candidate passes `validateCandidateSize` (≤350 lines), and an `OptimizationResult` JSON artifact is written to `.claude/artifacts/crew/gepa/opt/<run-id>.json` with `cycle_id`, `k: 5`, `candidates_evaluated: 5`, and either `no_winner: true` OR `winner: { candidate_id, pareto_rank: 1 }`.

AC-2: Given `--artifact-only` flag is passed, When optimize runs and finds a winner, Then `agents/fullstack-dev.md` is NOT modified, no `gepa/fullstack-dev/<trial-id>` branch is created, no PR is opened, and `git status` shows zero modified files outside `.claude/artifacts/crew/gepa/`.

AC-3: Given `--budget 0.10` (10 cents) is passed and case scoring averages $0.05/case, When optimize runs, Then the `dailyCapMeter` reservation fails partway through (after ~2 cases), the runner halts remaining cases, the written artifact carries `partial: true`, and the artifact's `winner` field is `null` (no promotion eligibility on partial runs).

AC-4: Given `aiplugin-dev` returns 5 candidates of which 1 is a 400-line prompt (oversized), When `runOptimization` calls `validateCandidateSize` BEFORE any LLM scoring spend, Then the 400-line candidate is rejected with `pareto_rank: null`, `rationale: "oversized_candidate"`, the event `gepa_oversized_candidate` is logged with the candidate's UUID, no budget is spent on scoring it, and the remaining 4 candidates proceed through scoring.

AC-5: Given 5 candidates produce trials with these results — t1: pass=true score=0.9 cost=0.10 latency=2000; t2: pass=true score=0.9 cost=0.10 latency=2000; t3: pass=true score=0.8 cost=0.05 latency=1500; t4: pass=false score=0.4 cost=0.05 latency=1000; t5: pass=true score=0.95 cost=0.20 latency=3000 — When `paretoRank` runs, Then t5, t1, t3 are rank-1 (mutually non-dominated), t2 has the same scores as t1 so the tiebreaker chain (`pass > score > -cost > -latency`, then `trial_id` asc) resolves deterministically, and t4 has `pareto_rank > 1` (dominated by t1).

AC-6: Given two non-dominated rank-1 candidates have identical `pass`, `score`, `cost_usd`, `latency_ms` values, When `paretoRank` runs twice on the same input, Then both runs return byte-identical winner orderings (determinism) and the `trial_id` lexicographic ascending order is the final tiebreaker.

AC-7: Given the persisted state at `.claude/artifacts/crew/gepa/no-winner-streak.json` records 2 consecutive `no_winner: true` cycles for `fullstack-dev`, When a third `/crew:gepa-optimize fullstack-dev` cycle completes with `no_winner: true`, Then the streak file is updated to `{ fullstack-dev: 3 }`, the event `gepa_no_winner_streak` is logged, and a subsequent `/crew:gepa-optimize fullstack-dev` invocation exits non-zero before any `CandidateGenerator.generate` call with stderr containing `no_winner_streak: 3 — run /crew:gepa-resume fullstack-dev to retry`.

AC-8: Given the streak file shows 3 for `fullstack-dev`, When `node scripts/crew.ts gepa-resume fullstack-dev` runs, Then the streak is cleared (set to 0 for that agent) and the next `/crew:gepa-optimize fullstack-dev` proceeds normally.

AC-9: Given the streak count for `fullstack-dev` is 2 and a cycle completes with a winner (`no_winner: false`), When the artifact is written, Then the streak counter for `fullstack-dev` resets to 0 (any success breaks the streak).

AC-10: Given `BudgetMeter.reserve` is called with `ttlSeconds: 600` and the process crashes between `reserve` and `record`/`release`, When the next optimize cycle runs after 600 seconds, Then the orphaned reservation is expired by the meter (per design spec line 329), the daily cap reflects the released budget, and the new cycle can proceed.

## Dependencies

- SLICE-96 (gepa-core): `runOptimization`, `paretoRank`, `dominates`, `validateCandidateSize`, `dailyCapMeter`, `fileLockManager`, Zod schemas.
- SLICE-97 (capture tee + config): `gepa.config.json` loader + capture infrastructure provide trial corpus to optimize against.
- SLICE-98 (eval): eval trials provide the failing-trial seed for `CandidateGenerator`.

## Risks

- **CHECKPOINT 1** risk: if the loop produces no winner 3 cycles in a row on real LLM calls, the design assumes hand-seeded 5 cases are too few to drive measurable optimization. Mitigation in the slice's run-brief: capture telemetry on candidate diversity (how often aiplugin-dev returns truly different prompts) and revisit dataset bootstrap before S5a.
- `aiplugin-dev` cost is unmetered today — the `BudgetMeter.reserve` BEFORE dispatch is the only guard against runaway spend. Verify reservation math against actual `aiplugin-dev` cost in S4 cycle 1 telemetry.
- `paretoRank` tiebreaker chain determinism is critical — `trial_id` must be UUIDv4 (or other stable string) and not generated mid-cycle in a way that depends on wall clock.
- 3-cycle no-winner streak persisted state must survive process crashes — written via tmp+rename atomic pattern (same as `soak.json` in S7).
- Synthetic failing trials fixture must be representative — too easy → spurious wins, too hard → 3-cycle halt without signal.

## References

- Design spec "Optimize (Phase 3, manual trigger)" diagram (lines 547–629).
- Design spec slice plan row S4 (line 860) — acceptance evidence: "full cycle on fullstack-dev produces measurable gain artifact OR clean no-winner exit. **CHECKPOINT 1**".
- Design spec "Risk-weighted exit gates → After S4 (CHECKPOINT 1)" (line 895).
- Design spec "Failure modes" table rows: "Optimize candidate generation returns < k candidates", "Optimize candidate exceeds 350-line cap", "Optimize all candidates dominated by champion", "Optimize `runOptimization` for an agent returns no winner 3 cycles in a row", "Optimize budget cap hit during candidate runs", "Optimize Pareto rank shows tie at #1", "Optimize held-out case scores reveal tail risk".
- Design spec "Testing strategy → crew integration tests" rows: `optimize-artifact-only`, `optimize-budget-halt`, `optimize-tail-risk-block`, `oversized-candidate-rejected` (lines 791–793, 798).
- Design spec "Kill-switches → Optimization global pause" (line 710).
- Design spec "Shape rationale → `validateCandidateSize` is exposed so the runner can pre-screen oversized candidates BEFORE scoring spend" (line 461).
