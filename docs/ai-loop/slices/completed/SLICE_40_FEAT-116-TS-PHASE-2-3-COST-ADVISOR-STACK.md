---
id: SLICE-40
status: completed
feature: FEAT-116
phase: null
priority: P1
target_release: null
requires_validation: true
created: 2026-06-07
updated: 2026-06-07
completed_at: 2026-06-07
---
# SLICE-40: # FEAT-116 — TS Phase 2.3: cost-advisor stack

Implements FEAT-116. See [feature file](../../../backlog/in-progress/FEAT-116.md) for product context.

## Objective

Migrate cost-advisor (485 lines), cost-advisor-grades (105 lines),

## In scope

- bullet 1
- bullet 2

## Out of scope

- bullet 1

## Acceptance criteria

- [ ] AC-1: `scripts/lib/cost-advisor.mjs` renamed to `.ts`; imports updated.
- [ ] AC-2: `scripts/lib/cost-advisor-grades.mjs` renamed to `.ts`; imports updated.
- [ ] AC-3: `scripts/lib/cost-advisor-rules.mjs` renamed to `.ts`; imports updated.
- [ ] AC-4: `scripts/lib/session-cost.mjs` renamed to `.ts`; imports updated.
- [ ] AC-5: Explicit TypeScript types; no `any`; `tsc --noEmit` clean.
- [ ] AC-6: Strategy as function pointer for rule dispatch (no class wrappers for switch-on-string).
- [ ] AC-7: Functions >30 lines split per SRP.
- [ ] AC-8: All CI gates pass.

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-116 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
