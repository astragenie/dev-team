---
id: SLICE-95
feat: FEAT-170
status: completed
created: 2026-06-29
title: FEAT-170 SLICE-D — label-gated agent-eval-regression CI workflow + 2-week promotion plan
autonomous_safe: true
risk_band: 0.2
estimated_loc: 120
estimated_files: 2
completed_at: 2026-06-29
updated: 2026-06-29
---
# SLICE-95: FEAT-170 SLICE-D — label-gated agent-eval-regression CI workflow

## Intent

Promote `evals/agents/crew-fullstack-dev.yaml` (now at `specs/crew-fullstack-dev.yaml` post-SLICE-107) to a label-gated GitHub Actions workflow. Advisory-first; promote to blocking after a 2-week stability baseline.

## Scope

- `.github/workflows/agent-eval-regression.yml` — triggers on PR label `run-evals` (manual opt-in)
- Runs `bun run evals --dry-run --prompt fullstack-dev` — heuristic asserts only (live judge upgrade waits for `--candidate-live` workflow glue)
- Reports as an advisory check; does NOT block merge
- `docs/diagnostics/fullstack-dev-baseline-2026-06-21.md` — extended with "CI promotion plan" section + `2026-07-13` blocking-promotion checkpoint

## Acceptance criteria

- [ ] **AC-1: Workflow exists and is label-gated.** Given a fresh checkout, When `cat .github/workflows/agent-eval-regression.yml` runs, Then the workflow declares `pull_request: types: [labeled]` and gates execution on `github.event.label.name == 'run-evals'`. Pass-fail: file exists AND grep matches the label filter.

- [ ] **AC-2: Workflow runs heuristic asserts via dry-run.** Given the workflow on a label-triggered PR, When the workflow body executes, Then the eval invocation is exactly `bun run evals --dry-run --prompt fullstack-dev`. Pass-fail: grep matches the command verbatim.

- [ ] **AC-3: Advisory-only — does NOT block merge.** Given the workflow result, When a PR with the `run-evals` label closes with FAIL, Then PR mergeable status remains `MERGEABLE`. Pass-fail: workflow has `continue-on-error: true` OR no `required_status_check` entry references this workflow in branch protection.

- [ ] **AC-4: Promotion plan documented with date checkpoint.** Given the diagnostics doc, When `grep "2026-07-13" docs/diagnostics/fullstack-dev-baseline-2026-06-21.md` runs, Then the date appears as the 2-week stability checkpoint for blocking-promotion. Pass-fail: grep matches and the surrounding paragraph names the demote-or-promote decision criteria.

## Out of scope

- Live judge in CI (waits for FEAT-171 `--candidate-live` workflow glue)
- Promotion to blocking (waits for the 2-week stability window observation; tracked as carry-forward, not in this slice)

## Risks

- Noisy false-positives from the heuristic asserts during the 2-week window. Mitigation: explicit "demote or refine before promotion" instruction in the diagnostics doc; date checkpoint forces the decision.

## Closing notes

This slice file is reconstructed post-implementation to satisfy the runner's slice-complete schema. The actual code commit landed in `9a0076a feat(ci): SLICE-95 — label-gated eval regression workflow + CI promotion plan doc` on the `refactor/feat-170-routing-and-ci-gate` branch, merged to main as `886cd98` (PR #130).
