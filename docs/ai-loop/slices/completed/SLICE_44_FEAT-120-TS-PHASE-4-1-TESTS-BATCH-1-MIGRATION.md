---
id: SLICE-44
status: completed
feature: FEAT-120
phase: null
priority: P1
target_release: null
requires_validation: true
created: 2026-06-07
updated: 2026-06-10
completed_at: 2026-06-07
github_issue: 106
github_url: "https://github.com/sergeymilashico/hero-crew/issues/106"
---
# SLICE-44: # FEAT-120 — TS Phase 4.1: tests batch 1 migration

Implements FEAT-120. See [feature file](../../../backlog/in-progress/FEAT-120.md) for product context.

## Objective

Rename first 22 test files from `.mjs` to `.ts`. Adds TypeScript strict annotations to test code. Ensures all test imports reference `.ts` sources consistently.

## In scope

- bullet 1
- bullet 2

## Out of scope

- bullet 1

## Acceptance criteria

- [ ] AC-1: All 22 `.mjs` test files renamed to `.ts`.
- [ ] AC-2: `node --test --experimental-strip-types` discovers and runs `.ts` test files correctly.
- [ ] AC-3: No `any`; `tsc --noEmit` clean.
- [ ] AC-4: All existing tests pass (same count as before, minus WSL pre-existing failures).
- [ ] AC-5: All CI gates pass.

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-120 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
