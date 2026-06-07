---
id: SLICE-35
status: completed
feature: FEAT-111
phase: null
priority: P1
target_release: null
requires_validation: true
created: 2026-06-07
updated: 2026-06-07
completed_at: 2026-06-07
---
# SLICE-35: # FEAT-111 — TS Phase 1.6: briefing collector + briefing.mjs

Implements FEAT-111. See [feature file](../../../backlog/in-progress/FEAT-111.md) for product context.

## Objective

Migrate the briefing collector (largest file in briefing subsystem) and

## In scope

- bullet 1
- bullet 2

## Out of scope

- bullet 1

## Acceptance criteria

- [ ] AC-1: `scripts/lib/briefing/collect.mjs` renamed to `.ts`; imports updated.
- [ ] AC-2: `scripts/lib/briefing.mjs` renamed to `.ts`; imports updated.
- [ ] AC-3: Explicit TypeScript types; no `any`; `tsc --noEmit` clean.
- [ ] AC-4: Dead code removed (noUnusedLocals/noUnusedParameters).
- [ ] AC-5: `Result<T,E>` applied where domain errors are meaningful.
- [ ] AC-6: Functions >30 lines split per SRP.
- [ ] AC-7: All CI gates pass.

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-111 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
