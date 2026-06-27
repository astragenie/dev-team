---
id: SLICE-104
parent: FEAT-183
status: triaged
priority: P1
created: 2026-06-27
title: "FEAT-183 S7 — architect hand-labeled cases + soak monitor (dual clock + sample floor + early-revert) + PromotionPolicy defaults + champion_frozen — CHECKPOINT 2"
stack: typescript + markdown
autonomous_safe: false
est_days: 3
depends_on: [SLICE-100, SLICE-101, SLICE-102, SLICE-103]
touches_files:
  - gepa-core/src/algorithms/soak-monitor.ts
  - gepa-core/src/algorithms/promotion-gate.ts
  - gepa-core/src/index.ts
  - gepa-core/CHANGELOG.md
  - gepa-core/tests/soak-monitor.test.ts
  - gepa-core/tests/promotion-gate.test.ts
  - agents/architect/.gepa/eval/seed-001.jsonl
  - agents/architect/.gepa/eval/seed-002.jsonl
  - agents/architect/.gepa/eval/seed-003.jsonl
  - agents/architect/.gepa/eval/seed-004.jsonl
  - agents/architect/.gepa/eval/seed-005.jsonl
  - agents/architect/.gepa/eval/seed-006.jsonl
  - agents/architect/.gepa/eval/seed-007.jsonl
  - agents/architect/.gepa/eval/seed-008.jsonl
  - agents/architect/.gepa/rubric.md
  - scripts/lib/gepa/soak-dispatcher-hook.ts
  - scripts/lib/slice-linker/dispatch.mts
  - gepa.config.json
  - tests/gepa/architect-eval.test.ts
  - tests/gepa/soak-dry-run-regression.test.ts
  - tests/gepa/soak-sample-floor.test.ts
  - tests/gepa/soak-insufficient-traffic.test.ts
---

# SLICE-104: FEAT-183 S7 — architect eval + soak monitor + policy + champion_frozen — CHECKPOINT 2

## Scope

Two coupled workstreams:

**1. Architect eval dataset (operator + critical-thinking agent collab):**
- 8 hand-labeled `EvalCase` rows under `agents/architect/.gepa/eval/seed-00{1..8}.jsonl` covering: greenfield design (1), cross-plugin refactor (1), spec-to-plan translation (1), risk pre-mortem (1), trade-off matrix (1), ADR draft (1), open-question surfacing (1), spike scope decision (1). At least 2 are `held_out: true`.
- `agents/architect/.gepa/rubric.md` with criteria: `non-goals-explicit`, `failure-modes-named`, `dependencies-graphed`, `interfaces-typed`, `test-strategy-present`, `tradeoffs-articulated`.
- Cases labeled with help from `crew:3rdparty:critical-thinking` (the "challenge mode" judge per design open question).

**2. Soak harness + promotion gate (library + crew):**
- `gepa-core/src/algorithms/soak-monitor.ts` — implements dual-clock + sample-floor logic per design spec lines 638–650. Watches `.claude/artifacts/crew/gepa/soak.json` for active soaks per agent; after every dispatch checks `elapsed_days >= soakDays AND soak_trials_count >= minSoakTrials`. On `maxSoakDays` cap with insufficient traffic, reverts with `soak_insufficient_traffic`. Rolling 1-day window early-revert at `soak_pass_rate < main_pass_rate - 0.10`.
- `gepa-core/src/algorithms/promotion-gate.ts` — implements the 5-condition promotion gate: pareto_rank==1, held_out_pass >= champion + minPassDelta, min held_out_case_score >= minCaseScoreFloor, no cost regression, no latency regression. Returns `{ eligible: boolean, blockedBy: string[] }`.
- `scripts/lib/gepa/soak-dispatcher-hook.ts` — crew-side hook called from `scripts/lib/slice-linker/dispatch.mts` (the existing slice-build orchestrator). Reads `soak.json` on each dispatch; if agent has active soak and `Math.random() < soakPercent`, uses the soak champion. Tees soak trials with `source: "soak"`. Scored fire-and-forget by the same `Scorer` configured for the agent's eval pipeline (typically rubricScorer with configured LLMJudge).
- `gepa.config.json` extended with `policy` block populated with design defaults (`min_pass_delta: 0.05`, `min_case_score_floor: 0.6`, `soak_percent: 0.10`, `soak_days: 7`, `min_soak_trials: 20`, `max_soak_days: 21`, `soak_epsilon: 0.02`, allow regressions both false), plus `champion_frozen: []` array.
- Four integration tests: `architect-eval.test.ts`, `soak-dry-run-regression.test.ts`, `soak-sample-floor.test.ts`, `soak-insufficient-traffic.test.ts`.

**CHECKPOINT 2**: dry-run soak end-to-end with a crafted regression (artificially worsened candidate). If the soak harness's rolling 1-day window can't detect the regression within `minSoakTrials` dispatches, stop — do not ship S8a/S8b.

## Acceptance criteria

AC-1: Given 8 architect cases under `agents/architect/.gepa/eval/`, When `/crew:gepa-eval architect` runs against `rubricScorer(resolveJudge(config, "architect"))` (typically routed to a higher-capability cloud judge per `judge_per_agent`), Then the aggregate at `.claude/artifacts/crew/gepa/eval/<run-id>.json` reports `total_cases: 8`, `held_out_cases: 2`, all 6 rubric criteria populated, AND no `scorer_circular` warning emitted.

AC-2: Given a virtual clock advanced to day 5 (`elapsed_days: 5`) with `soak_trials_count: 25` on an active soak for `fullstack-dev`, When `soakMonitor.evaluate()` runs with `policy.soak_days: 7, policy.min_soak_trials: 20`, Then `promote_eligible: false` because `elapsed_days < soakDays`; advance to day 7 with `soak_trials_count: 25`, then `promote_eligible: true` (both gates met).

AC-3: Given `elapsed_days: 7` with `soak_trials_count: 5` (sample floor not met), When `soakMonitor.evaluate()` runs, Then `promote_eligible: false`; advance to day 14 with `soak_trials_count: 8`, `promote_eligible: false`; advance to day 21 (`maxSoakDays`) with `soak_trials_count: 10`, Then a `soak_insufficient_traffic` event is emitted, the soak is reverted (pointer deleted), AND `gepa_soak_insufficient_traffic` appears in `.claude/logs/events.jsonl`.

AC-4: Given a crafted regression where `soak_pass_rate: 0.50` and `main_pass_rate: 0.80` (30pp gap) for a rolling 1-day window during an active soak for `fullstack-dev`, When `soakMonitor.evaluate()` runs (any day during soak), Then the early-revert fires immediately: the soak pointer is deleted, `gepa_soak_revert_early` is logged with `delta: -0.30`, and a forensics artifact appears at `.claude/artifacts/crew/gepa/soak/fullstack-dev-early-revert-<ts>.json` containing the soak trial summaries.

AC-5: Given a `Trial` candidate with `pareto_rank: 1`, `held_out_pass: 0.85`, champion `held_out_pass: 0.78` (7pp gain), `min_held_out_case_score: 0.65`, `cost_usd_delta: -0.05` (improvement), `latency_ms_delta: 0`, When `promotionGate.evaluate(candidate, champion, policy)` runs with default policy, Then `eligible: true, blockedBy: []`.

AC-6: Given the same candidate but `min_held_out_case_score: 0.55` (below 0.6 floor), When `promotionGate.evaluate` runs, Then `eligible: false, blockedBy: ["tail_risk_block"]`, AND `gepa_tail_risk_block` is logged.

AC-7: Given a candidate with `pareto_rank: 1` and `held_out_pass: 0.80` vs champion `0.78` (2pp gain, below 5pp `minPassDelta`), When `promotionGate.evaluate` runs, Then `eligible: false, blockedBy: ["min_pass_delta_not_met"]`; given `pareto_rank: 2`, `blockedBy: ["not_pareto_rank_1"]` (added to the array if other conditions also fail).

AC-8: Given `gepa.config.json` has `champion_frozen: ["inspector"]`, When `/crew:gepa-optimize inspector` runs, Then the command exits non-zero with stderr containing `champion_frozen: inspector — use /crew:gepa-thaw inspector to remove from list` before any `CandidateGenerator.generate` call, AND `gepa_champion_frozen` is logged. Given `inspector` is not on the frozen list, the cycle proceeds normally.

AC-9: Given a soak dry-run test (`tests/gepa/soak-dry-run-regression.test.ts`) injects a crafted regression candidate after artificially worsening the prompt by removing 30 lines of guidance, When the soak harness runs against the synthetic dispatch stream with `minSoakTrials: 20` dispatches per day, Then the rolling 1-day window early-revert fires within the first day's 20 dispatches AND no soak makes it past day 1 without revert — **CHECKPOINT 2 PASS**. If the harness fails to detect the crafted regression within 20 dispatches, the test fails RED and S8a/S8b are blocked.

AC-10: Given a soak dispatcher hook runs and `Math.random()` returns `0.05` (below `soakPercent: 0.10`) for an agent with an active soak, When the dispatch fires, Then the soak champion prompt path is used (not main), the resulting artifact is captured with `source: "soak"`, AND the trial is scored fire-and-forget by the same `Scorer` configured for that agent's eval pipeline (typically `rubricScorer`), preserving continuous-score signal per design line 636.

## Dependencies

- SLICE-100/101/102: rubricScorer + judge resolution + horizontalize provide the scoring infrastructure for soak.
- SLICE-103: inspector eval pipeline as the model for "scorer-class agent eval"; architect follows the same pattern.

## Risks

- **CHECKPOINT 2** failure risk: if the soak harness cannot detect crafted regression in 1-day rolling window, the entire promotion mechanism is broken. Design spec line 897 makes this a hard stop — do not ship S8a/S8b.
- Architect dataset hand-labeling is the most expensive task in the slice (~half-day per case × 8 cases ≈ 4 days). Design spec flags 3-day contingency at line 851. This slice's est_days: 3 ALREADY ABSORBS the contingency by routing some labeling to `crew:3rdparty:critical-thinking` as a labeler proxy. If that approach proves low-quality, slice may slip — surface in CHECKPOINT 2 review.
- Soak monitor virtual clock testing must use deterministic time injection (no real `Date.now()`) — Bun's `vi.useFakeTimers` equivalent is required.
- `soak.json` atomic-swap writes (per design line 699) — if the dispatcher reads mid-write, retry once before falling back to main champion. Cover in `soak-dry-run-regression.test.ts`.
- `champion_frozen` and `optimize.paused` overlap — design spec line 842 documents the precedence rule (`optimize.paused` checked first, then `champion_frozen`). Implementation must obey the order; misordering would surface as `champion_frozen` agents bypassing the global pause.
- Soak hook in `dispatch.mts` is a hot-path edit — must be guarded by `try/catch` so a malformed `soak.json` cannot crash dispatch (design failure mode "Soak dispatcher can't read soak.json → use main champion").

## References

- Design spec "Soak phase mechanics" (lines 631–652) — dual-clock + sample-floor + rolling-window + early-revert + insufficient-traffic.
- Design spec "Library API surface → Interfaces → PromotionPolicy" (lines 305–316).
- Design spec slice plan row S7 (line 865) — acceptance evidence: "architect eval produces aggregate, soak harness detects crafted regression on dummy promotion within rolling 1-day window. **CHECKPOINT 2**".
- Design spec "Resolved concerns → C13 Soak conflates clock and sample size" (line 70).
- Design spec "Resolved concerns → C20 Soak trial scoring path undefined" (line 77) — soak scored by configured rubricScorer.
- Design spec "Resolved concerns → C24 freeze a champion kill-switch missing" (line 81).
- Design spec "Risk-weighted exit gates → After S7 (CHECKPOINT 2)" (line 897).
- Design spec "Kill-switches" (lines 705–722) — items 4 (optimize global pause) and 6 (freeze a champion) precedence.
- Design spec "Implementation notes → S7 — soak harness" (lines 840–847) — champion-frozen vs optimize-paused UX overlap.
- Design spec "Failure modes" table rows: "Soak rolling 1-day window", "Soak dispatcher can't read soak.json", "Soak soak.json torn write", "Soak maxSoakDays reached without minSoakTrials" (lines 696–700).
- Design spec "Testing strategy → crew integration tests" rows: `soak-promote-happy-path`, `soak-revert-on-regression`, `soak-sample-floor`, `soak-insufficient-traffic` (lines 794–795, 802–803).
