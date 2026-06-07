---
id: SLICE-37
status: completed
feature: FEAT-113
phase: null
priority: P1
target_release: null
requires_validation: true
created: 2026-06-07
updated: 2026-06-07
completed_at: 2026-06-07
---
# SLICE-37: # FEAT-113 — TS Phase 1.8: installer core modules

Implements FEAT-113. See [feature file](../../../backlog/in-progress/FEAT-113.md) for product context.

## Objective

Migrate the installer core — 7 modules + the installer facade. These depend

## In scope

- bullet 1
- bullet 2

## Out of scope

- bullet 1

## Acceptance criteria

- [ ] AC-1: `scripts/lib/installer/audit.mjs` renamed to `.ts`; imports updated.
- [ ] AC-2: `scripts/lib/installer/claude-md.mjs` renamed to `.ts`; imports updated.
- [ ] AC-3: `scripts/lib/installer/harness-files.mjs` renamed to `.ts`; imports updated.
- [ ] AC-4: `scripts/lib/installer/legacy-migration.mjs` renamed to `.ts`; imports updated.
- [ ] AC-5: `scripts/lib/installer/repo-guides.mjs` renamed to `.ts`; imports updated.
- [ ] AC-6: `scripts/lib/installer/settings.mjs` renamed to `.ts`; imports updated.
- [ ] AC-7: `scripts/lib/installer/global.mjs` renamed to `.ts`; imports updated.
- [ ] AC-8: `scripts/lib/installer.mjs` renamed to `.ts`; imports updated.
- [ ] AC-9: Explicit TypeScript types; no `any`; `tsc --noEmit` clean.
- [ ] AC-10: Dead code removed.
- [ ] AC-11: `Result<T,E>` applied where domain errors are meaningful.
- [ ] AC-12: Functions >30 lines or files >300 lines split per SRP.
- [ ] AC-13: All CI gates pass.

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-113 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
