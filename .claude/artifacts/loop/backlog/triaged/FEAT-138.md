---
id: FEAT-138
title: "Fix CI red on main — contracts TS regen drift"
status: triaged
priority: P1
category: ci/maintenance
target_release: null
created: 2026-06-09
updated: 2026-06-09
triaged_at: 2026-06-09
depends_on: []
slices: []
derived_from: null
autonomous_safe: true
pm_customer_impact: 0.9
pm_effort_estimate: 0.2
pm_strategic_alignment: 0.8
pm_technical_risk: 0.2
pm_dependency_depth: 0.1
triage_notes: "P1 CI fix — autonomous_safe: true. Concrete repair: regen valid-feat-contracts.ts, fix negative-fixture drift handling in validate-contracts.ts, add one locking test, CI green. No design decisions required."
---
# FEAT-138: Fix CI red on main — contracts TS regen drift

## Description

`main` CI is red across at least the last 3 runs (2026-06-09 03:55, 04:15, 05:53), pre-dating PR #114 (FEAT-020 SLICE-2). Two distinct failures in the "Validate contracts" job:

1. `ERR: drift: committed TS missing at tests/fixtures/openapi/broken-missing-examples-contracts.ts — run with --write and commit the regenerated file`
2. `ERR: drift: tests/fixtures/openapi/valid-feat-contracts.ts differs from regenerated TS (committed=88 lines, regenerated=88 lines) — run with --write and commit the regenerated file`

Failure #1 is suspicious: `broken-missing-examples.openapi.yaml` is a negative fixture (the CI wraps it in `if validate-contracts; then exit 1; fi`). validate-contracts tooling is producing a drift error on a fixture that's intentionally broken — the regen step should skip negative fixtures, or the test harness should isolate the negative-fixture run from the regen check.

Failure #2 is a real drift: committed TS for `valid-feat-contracts.ts` no longer matches what `validate-contracts.ts --write` would produce. Most likely cause: a recent change to the codegen template (e.g. parameter sorting, comment header, version string) without a follow-up regen commit.

## Acceptance

- `valid-feat-contracts.ts` regenerated via `node scripts/validate-contracts.ts --write <path>` and the result committed.
- Negative-fixture path in `scripts/validate-contracts.ts` either skips the drift check or the CI wrapper isolates that file from the drift step (no spurious "drift: committed TS missing" on intentionally-broken inputs).
- Main CI green on the next push.
- One test added that locks in the negative-fixture handling — pass-when-broken should not also fail-on-drift.

## Notes

- Discovered while merging PR #114 (FEAT-020 SLICE-2, parallel-runner refactor). PR change did not touch contracts; same failure visible on `main` directly.
- Failure log lives in the PR-114 run history: `gh run view 27194950695 --log-failed`.
- Suspect commit boundary: recent build-bundle / cost-report work in v0.24.x may have touched the codegen path. `git log --oneline --since="2026-06-05" -- scripts/validate-contracts.ts tests/fixtures/openapi/` will narrow.
