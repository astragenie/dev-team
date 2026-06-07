---
id: SLICE-42
status: completed
feature: FEAT-118
phase: null
priority: P1
target_release: null
requires_validation: true
created: 2026-06-07
updated: 2026-06-07
completed_at: 2026-06-07
---
# SLICE-42: # FEAT-118 — TS Phase 3.1: entrypoint cutover

Implements FEAT-118. See [feature file](../../../backlog/in-progress/FEAT-118.md) for product context.

## Objective

Migrate the main entrypoints (`scripts/crew.mjs` + 9 sibling entrypoints) to `.ts`. Update all skill `.md` references, marketplace.json, and agent prompts that reference scripts. This completes the runtime-visible portion of the TS migration.

## In scope

- bullet 1
- bullet 2

## Out of scope

- bullet 1

## Acceptance criteria

- [ ] AC-1: `scripts/crew.mjs` renamed to `crew.ts`; all other entrypoints renamed to `.ts`.
- [ ] AC-2: All skill `.md` files with script references updated to `.ts` paths.
- [ ] AC-3: `marketplace.json` entrypoint references updated.
- [ ] AC-4: Agent prompts referencing scripts updated.
- [ ] AC-5: No `any`; `tsc --noEmit` clean.
- [ ] AC-6: Functions >30 body lines split.
- [ ] AC-7: All CI gates pass (npm test 437+, lint clean, typecheck exit 0).
- [ ] AC-8: e2e smoke passes (`npm run e2e:smoke`).

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-118 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
