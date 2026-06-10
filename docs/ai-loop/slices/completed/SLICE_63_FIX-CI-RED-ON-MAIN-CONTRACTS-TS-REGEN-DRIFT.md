---
id: SLICE-63
status: completed
feature: FEAT-138
phase: null
priority: P1
target_release: null
requires_validation: true
created: 2026-06-10
updated: 2026-06-10
completed_at: 2026-06-10
---
# SLICE-63: Fix CI red on main — contracts TS regen drift

Implements FEAT-138. See [feature file](../../../backlog/in-progress/FEAT-138.md) for product context.

## Objective

`main` CI is red across at least the last 3 runs (2026-06-09 03:55, 04:15, 05:53), pre-dating PR #114 (FEAT-020 SLICE-2). Two distinct failures in the "Validate contracts" job:

## In scope

- bullet 1
- bullet 2

## Out of scope

- bullet 1

## Acceptance criteria

- [ ] AC-1: All tests pass (npm test) and linter is clean (npm run lint)
- [ ] AC-2: <replace with a concrete, testable acceptance criterion>

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-138 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
