---
id: SLICE-05
status: completed
feature: FEAT-001
phase: null
priority: P2
target_release: null
created: 2026-05-27
updated: 2026-05-27
completed_at: 2026-05-27
---
# SLICE-05: Performance letter grades (A-F) in cost-advisor

Implements FEAT-001. See [feature file](../../../backlog/in-progress/FEAT-001.md) for product context.

## Objective

Compute composite A-F grade from: compaction count, subagent count, re-read count, tool failure rate, cache hit %. Surface in cost-advise artifacts. File: scripts/lib/cost-advisor.mjs. AC: buildCostAdvisor returns grade field, grade in markdown output, thresholds documented, test covers grade computation.

## In scope

- bullet 1
- bullet 2

## Out of scope

- bullet 1

## Acceptance criteria

- [ ] AC-1: ...
- [ ] AC-2: ...

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-001 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
