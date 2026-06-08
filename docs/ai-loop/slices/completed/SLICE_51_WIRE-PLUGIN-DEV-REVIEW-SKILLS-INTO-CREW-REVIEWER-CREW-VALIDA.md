---
id: SLICE-51
status: completed
feature: FEAT-125
phase: null
priority: P2
target_release: null
requires_validation: false
created: 2026-06-08
updated: 2026-06-08
---
# SLICE-51: Wire plugin-dev review skills into crew:reviewer/crew:validator for plugin work

Implements FEAT-125. See [feature file](../../../backlog/done/FEAT-125.md) for product context.

## Objective

Wire `plugin-dev:plugin-validator` and `plugin-dev:skill-reviewer` into `crew:reviewer` with formal required-dispatch language and routing-table rows.

## In scope

- Design doc confirming Path A selection with rationale
- CHANGELOG entry for FEAT-125

## Out of scope

- New TypeScript code
- Local skill copies (Path B rejected)
- `agents/validator.md` changes (plugin-dev is review-time, not validation-time)

## Acceptance criteria

- [x] Design doc picks Path A with rationale — `docs/superpowers/specs/2026-06-08-feat125-plugin-dev-skills-wiring-design.md`
- [x] `docs/routing-table.md` rows: "Plugin shape change" + "Skill shape change" → plugin-dev skills (shipped under FEAT-017)
- [x] `agents/reviewer.md` has required dispatch for plugin-dev:plugin-validator + plugin-dev:skill-reviewer (FEAT-017, lines 111–121)
- [x] `agents/validator.md` — no change needed; rationale in design doc
- [x] Self-test: plugin-dev wiring verified via grep — both skills present in reviewer.md and routing-table.md
- [x] CHANGELOG entry added under v0.22.0

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-125 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written

## Reviewer ladder

- Reviewer A: crew:reviewer (approved_with_notes 2026-06-08)
