---
description: Run one GEPA optimization cycle for an agent. Generates K candidate prompt variants, scores them, Pareto-ranks results, and writes an artifact JSON. When a winner is found and --artifact-only is not set, opens a promotion PR via gh CLI. Enforces daily budget cap and no-winner streak halt.
allowed-tools: Bash
---

# /crew:gepa-optimize

Run one GEPA Phase 3 optimization cycle for a named agent. Generates K candidate prompt variants from the current champion + failing trials, scores them, Pareto-ranks, and writes an `OptimizationResult` JSON to `.claude/artifacts/crew/gepa/opt/<run-id>.json`.

When a winner is found (Pareto rank-1, pass=true), the command automatically:

1. Checks branch protection on `main` via `gh api`.
2. Creates branch `gepa/<agent>/<trial-uuid>` from `main`.
3. Writes `gepa:` provenance frontmatter to `agents/<agent>.md`.
4. Commits + pushes the branch.
5. Opens a PR via `gh pr create` with promotion metadata.
6. Labels the PR: `gepa`, `agent:<agent>`, and `branch_protection_present` or `branch_protection_missing`.

Use `--artifact-only` (default) for dry-run cycles — no branch/PR is created.

## Usage

```
/crew:gepa-optimize <agent> --budget <usd> [--k <int>] [--artifact-only]
```

Flags:
- `<agent>` — required. Agent name (e.g. `fullstack-dev`).
- `--budget <usd>` — required. Daily budget cap in USD for this run. The `dailyCapMeter` enforces this against the persisted budget state in `.claude/artifacts/crew/gepa/budget.json`.
- `--k <int>` — number of candidates to generate per cycle. Default: `5`.
- `--artifact-only` — default `true`. When set, optimization runs without modifying `agents/<agent>.md`, creating branches, or opening PRs. All output is written to `.claude/artifacts/crew/gepa/`. Remove this flag (or pass `--no-artifact-only`) to enable auto-PR.

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
9. Auto-PR (when `--artifact-only` is NOT set and a winner is found):
   - Check `gh auth status` — if not authenticated, print manual `git push` + `gh pr create` commands to stdout and exit non-zero. No partial branch is left behind.
   - Call `gh api repos/:owner/:repo/branches/main/protection` — 404 → `branch_protection_missing`, PR opened with `--draft` + label `branch_protection_missing`.
   - Create branch `gepa/<agent>/<trial-uuid>` from main. On collision, append `-retry-<n>` (up to 5). NEVER `git push --force`.
   - Write `gepa:` YAML frontmatter to `agents/<agent>.md` (idempotent; atomic tmp+rename).
   - Commit: `chore(gepa): promote <agent> from cycle <cycle-id>`.
   - Push branch to origin.
   - `gh pr create` with body containing `Pareto rank`, `held-out pass`, `cost delta`, and a link to the opt artifact.
   - Label: `gepa`, `agent:<agent>`, `branch_protection_present` or `branch_protection_missing`.
   - No-op guard: if winner prompt content == current champion content, skip PR, set `no_op_promotion: true` in artifact.

## Auto-PR operator setup

Before enabling auto-PR, ensure these GitHub labels exist in the target repo:

```bash
gh label create gepa --color 0075ca --description "GEPA optimization PR"
gh label create "agent:fullstack-dev" --color e4e669
gh label create branch_protection_present --color 0e8a16
gh label create branch_protection_missing --color d93f0b
```

The `gh` token must have `repo:status` scope for the branch-protection check endpoint.

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
- `no_op_promotion` — true if winner prompt == current champion (PR skipped).
- `winner` — `{ candidate_id, pareto_rank, score, pass, cost_usd, latency_ms, prompt_path }` or null.
- `trials` — full trial list with `pareto_rank` assigned.
- `auto_pr` — `{ pr_opened, pr_url?, branch?, no_op_promotion?, exit_event? }` (present when auto-PR ran).

## See also

- `commands/gepa-eval.md` — run evals to build the failing-trial corpus.
- `commands/gepa-history.md` — inspect the trial store.
- `scripts/lib/gepa/optimize-runner.ts` — optimization loop implementation.
- `scripts/lib/gepa/auto-pr.ts` — auto-PR orchestrator.
- `scripts/lib/gepa/branch-protection-check.ts` — branch-protection check.
- `scripts/lib/gepa/champion-provenance-writer.ts` — frontmatter writer.
- `scripts/lib/gepa/candidate-generator-aiplugin.ts` — candidate generator.
- `scripts/lib/gepa/no-winner-streak-tracker.ts` — streak state management.
