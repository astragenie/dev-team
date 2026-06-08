---
id: SLICE-60
status: completed
feature: FEAT-132
phase: null
priority: P2
target_release: null
requires_validation: false
created: 2026-06-08
updated: 2026-06-08
completed_at: 2026-06-08
---
# SLICE-60: Implement FEAT-132

Implements FEAT-132. See [feature file](../../../backlog/in-progress/FEAT-132.md) for product context.

## Objective

`scripts/crew.ts` has both `FLAG_SPEC` (runtime array, ~90 flags) and a hand-written `Flags` TypeScript interface enumerating the same flags. Adding or removing a flag requires updating both — drift-prone.

## In scope

- `scripts/crew.ts` only — derive `Flags` type from `FLAG_SPEC` using mapped types; remove hand-written interface

## Out of scope

- Any other files

## Acceptance criteria

- [ ] AC-1: `Flags` interface replaced with a mapped type derived from `FLAG_SPEC`; no hand-written interface remains
- [ ] AC-2: `npm run typecheck` passes with the derived type; no runtime behaviour change
- [ ] AC-3: `npm test` and `npm run lint` clean

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-132 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
