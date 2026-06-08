---
id: SLICE-51
status: active
feature: FEAT-125
phase: null
priority: P2
target_release: null
requires_validation: true
created: 2026-06-08
updated: 2026-06-08
---
# SLICE-51: # Wire plugin-dev review skills into crew:reviewer/crew:validator for plugin work

Implements FEAT-125. See [feature file](../../../backlog/in-progress/FEAT-125.md) for product context.

## Objective

External `plugin-dev` plugin ships two high-value review skills:

## In scope

- bullet 1
- bullet 2

## Out of scope

- bullet 1

## Acceptance criteria

- [ ] Design doc picks Path A or B with rationale
- [ ] `docs/routing-table.md` row: "Plugin shape change /
- [ ] `agents/reviewer.md` updated with detection trigger
- [ ] `agents/validator.md` updated if behavior-level plugin checks apply
- [ ] Self-test: run review on hero-crew itself; plugin-dev skills fire
- [ ] CHANGELOG entry

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-125 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
