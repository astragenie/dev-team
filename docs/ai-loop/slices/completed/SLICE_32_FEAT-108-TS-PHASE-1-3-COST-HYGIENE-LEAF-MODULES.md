---
id: SLICE-32
status: completed
feature: FEAT-108
phase: null
priority: P1
target_release: null
requires_validation: true
created: 2026-06-07
updated: 2026-06-07
completed_at: 2026-06-07
---
# SLICE-32: # FEAT-108 — TS Phase 1.3: cost-hygiene leaf modules

Implements FEAT-108. See [feature file](../../../backlog/in-progress/FEAT-108.md) for product context.

## Objective

Migrate the 3 small cost-hygiene leaf modules that have no external callers

## In scope

- bullet 1
- bullet 2

## Out of scope

- bullet 1

## Acceptance criteria

- [ ] AC-1: `scripts/lib/cost-hygiene/state.mjs` renamed to `.ts`; imports updated.
- [ ] AC-2: `scripts/lib/cost-hygiene/decide.mjs` renamed to `.ts`; imports updated.
- [ ] AC-3: `scripts/lib/cost-hygiene/render-frontmatter.mjs` renamed to `.ts`; imports updated.
- [ ] AC-4: Explicit TypeScript types; no `any`; `tsc --noEmit` clean.
- [ ] AC-5: Dead code removed.
- [ ] AC-6: `Result<T,E>` applied where domain errors are meaningful.
- [ ] AC-7: All CI gates pass.

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-108 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
