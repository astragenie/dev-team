---
id: SLICE-45
status: completed
feature: FEAT-121
phase: null
priority: P1
target_release: null
requires_validation: true
created: 2026-06-07
updated: 2026-06-09
completed_at: 2026-06-07
---
# SLICE-45: # FEAT-121 — TS Phase 4.2: tests batch 2 migration

Implements FEAT-121. See [feature file](../../../backlog/in-progress/FEAT-121.md) for product context.

## Objective

Rename remaining 21 test files from `.mjs` to `.ts`. Completes Phase 4 — all test files now TypeScript.

## In scope

- bullet 1
- bullet 2

## Out of scope

- bullet 1

## Acceptance criteria

- [ ] AC-1: All 21 remaining `.mjs` test files renamed to `.ts`.
- [ ] AC-2: No `.mjs` test files remain in `tests/`.
- [ ] AC-3: No `any`; `tsc --noEmit` clean.
- [ ] AC-4: All existing tests pass (same count, minus WSL pre-existing failures).
- [ ] AC-5: All CI gates pass.

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-121 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
