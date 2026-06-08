---
id: SLICE-50
status: pending
feature: FEAT-122
phase: null
priority: P2
target_release: null
requires_validation: false
created: 2026-06-08
updated: 2026-06-08
---
# SLICE-50: Import 4 missing 3rd-party commands (create-prd, refactor-code, architecture-review, create-architecture-documentation)

Implements FEAT-122 part C. See [feature file](../../../backlog/in-progress/FEAT-122.md) for product context.

## Objective

Import 4 commands from claude-code-templates into `commands/3rdparty/`. Each is a `*.md` file with valid slash-command frontmatter and passes manifest validation.

## In scope

- `commands/3rdparty/create-prd.md` — from `project-management/create-prd`
- `commands/3rdparty/refactor-code.md` — from `utilities/refactor-code`
- `commands/3rdparty/architecture-review.md` — from `team/architecture-review`
- `commands/3rdparty/create-architecture-documentation.md` — from `documentation/create-architecture-documentation`
- Create `commands/3rdparty/` folder if absent
- Frontmatter normalization (name, description, arguments if any)

## Out of scope

- Agents import (SLICE-48)
- Skills import (SLICE-49)
- Wiring commands into routing or auto-invoke flows
- Removal or renaming of existing commands
- Closing FEAT-122 — done in this slice's `slice complete` step (last sibling)

## Acceptance criteria

- [ ] AC-1: 4 new command files exist at `commands/3rdparty/{create-prd,refactor-code,architecture-review,create-architecture-documentation}.md`
- [ ] AC-2: `node scripts/validate-manifests.ts` PASS
- [ ] AC-3: Each command frontmatter has `name`, `description` populated
- [ ] AC-4: `npm run lint` and `npm run format:check` clean (zero warnings)
- [ ] AC-5: `npm test` PASS (no regression)
- [ ] AC-6: No duplicate command name across `commands/` tree
- [ ] AC-7: FEAT-122 moves from `in-progress/` to `done/` (this is the final sibling slice)

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-122 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- `requires_validation: false` (additive command files, no runtime behavior change)

## Reviewer ladder

- Reviewer A: structural — frontmatter, manifest validator, folder convention
- Reviewer B: content quality — description triggering effectiveness, argument schema sanity
