---
id: SLICE-07
status: completed
feature: FEAT-003
phase: null
priority: P2
target_release: null
created: 2026-05-27
updated: 2026-05-27
completed_at: 2026-05-27
---
# SLICE-07: Cost health summary in brief-me output

Implements FEAT-003. See [feature file](../../../backlog/in-progress/FEAT-003.md) for product context.

## Objective

When recent cost reports exist, surface one-line health summary in brief-me: grade + top concern. AC: brief-me JSON includes costHealth field, contains grade (A-F) and topConcern, no field when no cost reports, test covers both cases. File: scripts/lib/briefing/collect.mjs.

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
- feature FEAT-003 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
