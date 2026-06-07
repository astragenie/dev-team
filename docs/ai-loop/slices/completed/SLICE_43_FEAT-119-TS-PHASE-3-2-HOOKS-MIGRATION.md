---
id: SLICE-43
status: completed
feature: FEAT-119
phase: null
priority: P1
target_release: null
requires_validation: true
created: 2026-06-07
updated: 2026-06-07
completed_at: 2026-06-07
---
# SLICE-43: # FEAT-119 — TS Phase 3.2: hooks migration

Implements FEAT-119. See [feature file](../../../backlog/in-progress/FEAT-119.md) for product context.

## Objective

Rename plugin-distributed `hooks/*.mjs` to `.ts`. Update `hooks/hooks.json` path references. Repo-local `.claude/hooks/*.sh` are untouched (bash, not JS).

## In scope

- bullet 1
- bullet 2

## Out of scope

- bullet 1

## Acceptance criteria

- [ ] AC-1: All `hooks/*.mjs` files renamed to `.ts`.
- [ ] AC-2: `hooks/hooks.json` path references updated to `.ts`.
- [ ] AC-3: No `any`; `tsc --noEmit` clean.
- [ ] AC-4: Functions >30 body lines split.
- [ ] AC-5: All CI gates pass.

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-119 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
