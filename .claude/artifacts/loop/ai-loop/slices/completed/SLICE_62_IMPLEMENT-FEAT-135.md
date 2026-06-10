---
id: SLICE-62
status: completed
feature: FEAT-135
phase: null
priority: P2
target_release: null
requires_validation: false
created: 2026-06-08
updated: 2026-06-09
completed_at: 2026-06-08
---
# SLICE-62: Implement FEAT-135

Implements FEAT-135. See [feature file](../../../backlog/in-progress/FEAT-135.md) for product context.

## Objective

`.github/workflows/test.yml` runs `validate-routing-table.ts` with `continue-on-error: true` — routing violations don't fail CI. This is advisory-only, meaning routing drift goes undetected.

## In scope

- `.github/workflows/test.yml` only — remove `continue-on-error: true` from `validate-routing-table` step

## Out of scope

- Any other CI steps or files

## Acceptance criteria

- [ ] AC-1: `continue-on-error: true` removed from the `validate-routing-table.ts` step in `.github/workflows/test.yml`
- [ ] AC-2: `validate-routing-table.ts` exits 0 on current `main` (verified locally); `npm test` and `npm run lint` clean
- [ ] AC-3: No other CI step changed

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-135 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
