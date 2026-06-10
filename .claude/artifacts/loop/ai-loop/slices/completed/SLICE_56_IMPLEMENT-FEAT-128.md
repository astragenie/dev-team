---
id: SLICE-56
status: completed
feature: FEAT-128
phase: null
priority: P2
target_release: null
requires_validation: true
created: 2026-06-08
updated: 2026-06-10
completed_at: 2026-06-08
---
# SLICE-56: Implement FEAT-128

Implements FEAT-128. See [feature file](../../../backlog/in-progress/FEAT-128.md) for product context.

## Objective

Four validate-* scripts (`validate-manifests.ts`, `validate-skills.ts`, `validate-agents.ts`, `validate-slices.ts`) run sequentially. A concurrent runner improves local feedback speed.

## In scope

- `scripts/validate-all.ts` (new file)
- `package.json` scripts section — add `validate:all` entry

## Out of scope

- Changes to individual validate-*.ts scripts
- CI config changes

## Acceptance criteria

- [ ] AC-1: `npm run validate:all` exits 0 on clean repo
- [ ] AC-2: `npm run validate:all` exits 1 and prints all failures when any validator fails
- [ ] AC-3: Individual validate-manifests/skills/agents/slices scripts unchanged
- [ ] AC-4: `node --test --experimental-strip-types` passes, `npm run lint` zero warnings

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-128 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
