---
id: SLICE-61
status: completed
feature: FEAT-134
phase: null
priority: P2
target_release: null
requires_validation: false
created: 2026-06-08
updated: 2026-06-08
completed_at: 2026-06-08
---
# SLICE-61: Implement FEAT-134

Implements FEAT-134. See [feature file](../../../backlog/in-progress/FEAT-134.md) for product context.

## Objective

`scripts/lib/session-cost-scanner.ts` (582 lines) mixes pure computation (token aggregation, model-burn accumulation, cache hit calculation) with I/O — making pure logic hard to unit-test.

## In scope

- `scripts/lib/session-cost-scanner/compute.ts` (new) — pure functions extracted from `session-cost-scanner.ts`
- `scripts/lib/session-cost-scanner.ts` — becomes thin I/O wrapper importing from compute.ts

## Out of scope

- Any other files

## Acceptance criteria

- [ ] AC-1: Extracted functions in `compute.ts` have no `fs` / I/O imports; testable without mocks
- [ ] AC-2: Unit tests for extracted pure functions (token aggregation, cache hit calculation) pass
- [ ] AC-3: `npm test`, `npm run lint`, `npm run typecheck` all clean; no output change from scanner

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-134 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
