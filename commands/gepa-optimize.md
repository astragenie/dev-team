---
description: Run one GEPA optimization cycle for an agent. Generates K candidate prompt variants, scores them, Pareto-ranks results, and writes an artifact JSON. Enforces daily budget cap and no-winner streak halt.
allowed-tools: Bash
---

# /crew:gepa-optimize

Run one GEPA Phase 3 optimization cycle for a named agent. Generates K candidate prompt variants from the current champion + failing trials, scores them, Pareto-ranks, and writes an `OptimizationResult` JSON to `.claude/artifacts/crew/gepa/opt/<run-id>.json`.

## Usage

```
/crew:gepa-optimize <agent> --budget <usd> [--k <int>] [--artifact-only]
```

Flags:
- `<agent>` — required. Agent name (e.g. `fullstack-dev`).
- `--budget <usd>` — required. Daily budget cap in USD for this run. The `dailyCapMeter` enforces this against the persisted budget state in `.claude/artifacts/crew/gepa/budget.json`.
- `--k <int>` — number of candidates to generate per cycle. Default: `5`.
- `--artifact-only` — default `true` in CHECKPOINT 1. When set, optimization runs without modifying `agents/<agent>.md`, creating branches, or opening PRs. All output is written to `.claude/artifacts/crew/gepa/`.

## Behavior

1. Check the no-winner streak for `<agent>`. If streak ≥ 3, exit code 3 with an instructive message.
2. Load failing trials from `.claude/artifacts/crew/gepa/trials/<agent>.jsonl`.
3. Acquire `fileLockManager.acquire(agent, "optimize")` lock. If held, exit code 2.
4. Generate K candidate prompt files under `.claude/artifacts/crew/gepa/candidates/<cycle-id>/`.
   - Each candidate is pre-screened with `validateCandidateSize` (≤350 lines). Oversized candidates are rejected with event `gepa_oversized_candidate` and excluded from scoring.
   - Budget is reserved via `BudgetMeter.reserve()` BEFORE each candidate write.
5. Run candidates through the scorer.
6. Pareto-rank results (`pass > score > -cost > -latency > trial_id asc`).
7. Write `OptimizationResult` JSON artifact to `.claude/artifacts/crew/gepa/opt/<run-id>.json`.
8. Update no-winner streak.
   - Winner found → reset streak to 0.
   - No winner → increment streak; if new streak = 3, log `gepa_no_winner_streak_halt`.

## Exit codes

- `0` — cycle completed (winner or clean no-winner exit).
- `1` — internal error.
- `2` — bad args or lock held.
- `3` — no-winner streak ≥ 3. Run `/crew:gepa-resume <agent>` to clear.

## Artifact output

`OptimizationResult` JSON fields:
- `run_id` / `cycle_id` — UUID.
- `agent` — agent name.
- `k` — candidates requested.
- `candidates_evaluated` — candidates successfully scored.
- `partial` — true if budget cap halted mid-cycle (winner: null on partial).
- `no_winner` — true if no Pareto rank-1 candidate found.
- `winner` — `{ candidate_id, pareto_rank, score, pass, cost_usd, latency_ms, prompt_path }` or null.
- `trials` — full trial list with `pareto_rank` assigned.

## See also

- `commands/gepa-eval.md` — run evals to build the failing-trial corpus.
- `commands/gepa-history.md` — inspect the trial store.
- `scripts/lib/gepa/optimize-runner.ts` — optimization loop implementation.
- `scripts/lib/gepa/candidate-generator-aiplugin.ts` — candidate generator.
- `scripts/lib/gepa/no-winner-streak-tracker.ts` — streak state management.
