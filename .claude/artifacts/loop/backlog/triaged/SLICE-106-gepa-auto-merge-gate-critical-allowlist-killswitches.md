---
id: SLICE-106
parent: FEAT-183
status: triaged
priority: P1
created: 2026-06-27
title: "FEAT-183 S8b — auto-merge gate (5 conditions) + critical-agent allowlist + /crew:gepa-invalidate + /crew:gepa-revert + /crew:gepa-thaw + observability events"
stack: typescript + markdown
autonomous_safe: false
est_days: 2
depends_on: [SLICE-104, SLICE-105]
touches_files:
  - scripts/lib/gepa/auto-merge-gate.ts
  - scripts/lib/gepa/critical-agent-allowlist.ts
  - scripts/lib/gepa/observability-events.ts
  - commands/gepa-invalidate.md
  - commands/gepa-revert.md
  - commands/gepa-thaw.md
  - commands/gepa-resume.md
  - scripts/crew.ts
  - scripts/lib/gepa/optimize-runner.ts
  - tests/gepa/auto-merge-gate-five-conditions.test.ts
  - tests/gepa/critical-agent-allowlist.test.ts
  - tests/gepa/gepa-invalidate.test.ts
  - tests/gepa/gepa-revert.test.ts
  - tests/gepa/gepa-thaw.test.ts
  - tests/gepa/observability-event-emission.test.ts
---

# SLICE-106: FEAT-183 S8b — auto-merge gate + critical allowlist + kill-switch CLIs + observability

## Scope

Final slice. Lands the auto-merge gate, the critical-agent allowlist (`inspector`, `verifier`, `architect` → draft PR only, never auto-merge), all kill-switch CLIs, and the full observability event set.

- `scripts/lib/gepa/auto-merge-gate.ts` — combines the 5 conditions from `promotion-gate.ts` (SLICE-104) PLUS soak-pass + branch-protection-present + agent-eligibility (not on critical-agent allowlist, not in `champion_frozen`). If all gates green AND agent in `policy.eligible_agents` AND NOT in critical-agent allowlist → calls `gh pr merge --auto --squash` on the PR opened by SLICE-105's `auto-pr.ts`. Otherwise → leaves PR as draft for human review and logs the gate-by-gate verdict.
- `scripts/lib/gepa/critical-agent-allowlist.ts` — exports the hard-coded list `["inspector", "verifier", "architect"]`. Per design spec line 44, this list is NOT configurable in v1 (these agents have compounding effects; their failures cascade across the engineering loop).
- `scripts/lib/gepa/observability-events.ts` — central event emitter ensuring all 20 gepa events fire on the right path: `gepa_capture_drop`, `gepa_eval_start`, `gepa_eval_complete`, `gepa_opt_cycle_start`, `gepa_opt_no_winner`, `gepa_opt_promote`, `gepa_soak_start`, `gepa_soak_promote`, `gepa_soak_revert`, `gepa_soak_revert_early`, `gepa_soak_insufficient_traffic`, `gepa_budget_exceeded`, `gepa_tail_risk_block`, `gepa_oversized_candidate`, `gepa_judge_unreachable`, `gepa_judge_malformed`, `gepa_lock_collision`, `gepa_branch_protection_missing`, `gepa_no_winner_streak`, `gepa_champion_frozen` (+ `gepa_critical_agent_draft_pr` added in this slice for the allowlist path). Each event includes `trial_id` / `cycle_id` for correlation.
- New kill-switch CLI commands wired in `scripts/crew.ts`:
  - `/crew:gepa-invalidate --agent <name> [--since <iso>] [--tag <tag>]` → calls `TrialStore.invalidate({ agent, since, tag })`, writes audit row.
  - `/crew:gepa-revert --agent <name>` → deletes soak pointer (if active) AND if a champion-promotion PR is in soak window, reverts the prompt file via `git revert <promotion-commit>` (uses `prior_prompt_hash` provenance).
  - `/crew:gepa-thaw <agent>` → removes agent from `gepa.config.json` `champion_frozen` list.
  - `/crew:gepa-resume [<agent>]` → clears `optimize.paused: true` globally OR clears no-winner-streak for the named agent (re-uses SLICE-99 streak tracker).
- `scripts/lib/gepa/optimize-runner.ts` (final integration): on winner detection, calls `auto-merge-gate.ts` AFTER `auto-pr.ts` (SLICE-105) creates the PR. If the gate approves AND not critical-agent, fires `gh pr merge --auto --squash`. If critical-agent, leaves draft + emits `gepa_critical_agent_draft_pr`.

## Acceptance criteria

AC-1: Given a winning `fullstack-dev` candidate with all 5 gates green (pareto_rank=1, held_out_pass +7pp, min held_out case score 0.65, cost delta -0.05, latency delta 0), branch protection enforced on `main`, AND `fullstack-dev` in `policy.eligible_agents` AND NOT in `champion_frozen` AND NOT critical-agent, When `auto-merge-gate.ts` runs against the SLICE-105 PR, Then `gh pr merge --auto --squash` is invoked on the PR, the event `gepa_opt_promote` is logged with `agent: "fullstack-dev"` and `trial_id`, AND no direct `git push origin main` is executed.

AC-2: Given a winning `inspector` candidate with all 5 gates green AND branch protection enforced AND `inspector` in `policy.eligible_agents`, When `auto-merge-gate.ts` evaluates the gates, Then the critical-agent allowlist check fires FIRST, the PR is left as `--draft` (not promoted to ready-for-review), `gh pr merge --auto` is NEVER called, AND the event `gepa_critical_agent_draft_pr` is logged with `agent: "inspector"` AND the agent name appears in stdout for human review queue.

AC-3: Given a winning candidate with pareto_rank=1 but `min_held_out_case_score: 0.55` (below 0.6 floor), When `auto-merge-gate.ts` evaluates, Then the gate returns `eligible: false, blockedBy: ["tail_risk_block"]`, the PR is left as draft, `gepa_tail_risk_block` is logged with the offending case_id, AND no merge attempted.

AC-4: Given a winning candidate but `policy.eligible_agents` is `[]` (empty — operator hasn't enabled any agent for auto-merge), When `auto-merge-gate.ts` evaluates, Then `blockedBy: ["agent_not_eligible"]` is added, the PR stays draft for human review, no event other than the gate-verdict log fires.

AC-5: Given `node scripts/crew.ts gepa-invalidate --agent fullstack-dev --since 2026-06-25T00:00:00Z` runs against a trial JSONL with 50 rows where 20 have `created_at >= 2026-06-25`, When the command completes, Then 20 trials are marked invalidated (per `TrialStore.invalidate` semantics — soft delete with audit row for `fileStore`, tag-add for `astramemStore`), `store.recall({ agent, since })` no longer returns the invalidated rows, AND stdout reports `invalidated 20 trials for fullstack-dev since 2026-06-25T00:00:00Z`.

AC-6: Given an active soak for `fullstack-dev` and a recent promotion commit on `main`, When `node scripts/crew.ts gepa-revert --agent fullstack-dev` runs, Then the soak pointer in `.claude/artifacts/crew/gepa/soak.json` for that agent is deleted, the agent prompt file is reverted to the prior version (via `git revert <promotion-commit>` using `prior_prompt_hash` from frontmatter), an alarm event `gepa_soak_revert` is logged, AND a new revert commit lands on `main` (NOT force-push, NOT `git reset`).

AC-7: Given `gepa.config.json` has `champion_frozen: ["inspector", "architect"]`, When `node scripts/crew.ts gepa-thaw inspector` runs, Then `champion_frozen` becomes `["architect"]` (inspector removed, architect retained), the config is rewritten via `tmp + rename` atomic swap, AND a subsequent `/crew:gepa-optimize inspector` proceeds normally.

AC-8: Given the no-winner-streak counter from SLICE-99 records `{ fullstack-dev: 3 }`, When `node scripts/crew.ts gepa-resume fullstack-dev` runs, Then the counter is cleared to `{ fullstack-dev: 0 }`, AND given `gepa.config.json` has `optimize.paused: true`, When `node scripts/crew.ts gepa-resume` (no agent) runs, the global pause clears (`optimize.paused: false`).

AC-9: Given a full end-to-end cycle on `fullstack-dev` from optimize through auto-merge, When the cycle completes successfully, Then the following events appear in `.claude/logs/events.jsonl` in order: `gepa_opt_cycle_start`, `gepa_opt_promote`; given the cycle then enters soak and 7 days later promotes, additional events appear: `gepa_soak_start`, `gepa_soak_promote` — each carrying `cycle_id`, `agent`, and `trial_id` correlation fields.

AC-10: Given the test suite covers the 5 gate conditions × 32 truth-table combinations from design spec line 769 (`PromotionPolicy` gate logic) PLUS the critical-agent allowlist branch, When `bun test tests/gepa/auto-merge-gate-five-conditions.test.ts` runs, Then all 32 combos are asserted (PASS for the 1 all-green combo, FAIL with the right `blockedBy` reason for each of the 31 failure modes), plus 3 additional tests for the allowlist (inspector, verifier, architect all forced draft regardless of gate outcomes).

## Dependencies

- SLICE-104 (promotion-gate + soak-monitor): 5-condition gate logic + soak-pass signal.
- SLICE-105 (auto-pr + branch-protection-check + champion-provenance): PR scaffolding + provenance frontmatter that `gepa-revert` reads.

## Risks

- `gh pr merge --auto --squash` requires the gh token to have `repo` scope. Document in run-brief.
- Critical-agent allowlist is hard-coded in v1 per design line 44 — if operator's repo has different agents that should be treated as critical, they'd need a code change. Document as v1.1 deferral.
- `gepa-revert` calling `git revert` on `main` is a code-bearing commit — must be wrapped in `try/catch` so a failed revert (e.g. merge conflict from concurrent edits) surfaces cleanly and does NOT push a half-revert. Falls back to printing manual `git revert` command.
- Observability event coverage must be 100% — missing an event on a failure path makes the loop unobservable. The dedicated `observability-event-emission.test.ts` test must invoke every gate path and assert the corresponding event fires exactly once per trigger.
- `gepa-invalidate` audit row is the only forensic trail for tampering — must include `invalidated_by_pid`, `invalidated_at`, and `reason`. Without this, soft-deletes are indistinguishable from corruption.
- The `policy.eligible_agents: []` default (empty list) means NO agent auto-merges out of the box. Operator must explicitly opt-in by adding `fullstack-dev`, `backend-dev`, `frontend-dev` to the list. Design spec doesn't pin the default — interpret as "deny by default" per safety bias and document in slice run-brief.

## References

- Design spec "Optimize (Phase 3, manual trigger)" diagram, auto-merge branch (lines 601–625).
- Design spec "Locked decisions → Promotion policy" and "Critical-agent allowlist" (lines 43–44).
- Design spec slice plan row S8b (line 867) — acceptance evidence: "fullstack-dev real cycle passes all gates and auto-merges; inspector real cycle files draft PR; `champion_frozen` blocks new cycles".
- Design spec "Kill-switches" full list (lines 705–722) — items 3 (invalidate), 5 (revert), 6 (freeze), `/crew:gepa-thaw`.
- Design spec "Observability" event list (line 749) — all 20+ events; this slice ensures all of them fire on the right paths.
- Design spec "Resolved concerns → C8 No kill-switch / rollback story" (line 65) — five kill-switches enumerated; this slice ships the CLI surface for them.
- Design spec "Resolved concerns → C12 Manual review queue cadence undefined" (line 69) — `gepa_critical_agent_draft_pr` event surfaces the queue.
- Design spec "Failure modes" table rows: "Optimize tail risk block", "Promote auto-merge attempt", "Promote branch protection NOT configured", "Promote champion is on champion_frozen list" (lines 692, 701–703).
- Design spec "Testing strategy → gepa-core tests → PromotionPolicy" (line 769) — 32-combo truth table.
- Design spec "Testing strategy → crew integration tests" rows: `critical-agent-allowlist`, `champion-frozen-blocks-cycle`, `frontmatter-cap-exemption` (lines 796, 801, 804).
