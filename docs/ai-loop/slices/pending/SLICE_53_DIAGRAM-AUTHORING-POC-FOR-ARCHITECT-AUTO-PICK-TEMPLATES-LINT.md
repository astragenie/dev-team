---
id: SLICE-53
status: active
feature: FEAT-123
phase: null
priority: P2
target_release: null
requires_validation: true
created: 2026-06-08
updated: 2026-06-08
---
# SLICE-53: # Diagram authoring POC for architect — auto-pick + templates + lint

Implements FEAT-123. See [feature file](../../../backlog/in-progress/FEAT-123.md) for product context.

## Objective

POC enabling architect/document-writer agents to author technical diagrams

## In scope

- bullet 1
- bullet 2

## Out of scope

- bullet 1

## Acceptance criteria

- [ ] `diagram-methodology` SKILL.md extended with auto-pick decision rules
- [ ] `templates/` dir populated with ≥6 stubs covering C4 (2), sequence (1),
- [ ] `diagram-review` skill catches ≥3 categories of issues
- [ ] `routing-table.md` row added:
- [ ] 1 architect or doc-writer dispatch produces lint-clean Mermaid diagram

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-123 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
