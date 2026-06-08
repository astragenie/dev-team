---
id: SLICE-59
status: completed
feature: FEAT-131
phase: null
priority: P2
target_release: null
requires_validation: false
created: 2026-06-08
updated: 2026-06-08
completed_at: 2026-06-08
---
# SLICE-59: Implement FEAT-131

Implements FEAT-131. See [feature file](../../../backlog/in-progress/FEAT-131.md) for product context.

## Objective

`pathExists()` is defined in 5 separate files; `readJson()` is defined in 2 files. Both are identical utility functions.

## In scope

- `scripts/lib/fs-utils.ts` (new) — exports `pathExists(p: string): Promise<boolean>` and `readJson<T>(p: string): Promise<T>`
- Update all callers: `scripts/lib/briefing/collect.ts`, `scripts/lib/deployment-guidance/read.ts`, `scripts/lib/fleet.ts`, `scripts/lib/installer/util.ts`, `scripts/lib/wakeup.mjs`, `scripts/validate-manifests.ts`
- Delete local duplicate `pathExists`/`readJson` definitions from callers

## Out of scope

- Any other files or behaviour changes

## Acceptance criteria

- [ ] AC-1: All call sites import `pathExists`/`readJson` from `scripts/lib/fs-utils.ts`; local duplicate definitions removed
- [ ] AC-2: Unit tests for `pathExists` (existing/missing path) and `readJson` (valid JSON, missing file, malformed JSON) pass
- [ ] AC-3: `npm test`, `npm run lint`, `npm run typecheck` all clean

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-131 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
