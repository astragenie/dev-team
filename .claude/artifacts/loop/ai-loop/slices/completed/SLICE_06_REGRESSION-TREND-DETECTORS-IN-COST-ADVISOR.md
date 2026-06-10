---
id: SLICE-06
status: completed
feature: FEAT-002
phase: null
priority: P2
target_release: null
created: 2026-05-27
updated: 2026-05-27
completed_at: 2026-05-27
---
# SLICE-06: Regression trend detectors in cost-advisor

Implements FEAT-002. See [feature file](../../../backlog/in-progress/FEAT-002.md) for product context.

## Objective

Three new trend signals comparing last 3 slices: (1) compaction drift trending upward, (2) subagent creep dispatch count growing, (3) cost regression USD/slice increasing >20%. File: scripts/lib/cost-advisor.mjs. AC: each trend fires on synthetic 3-report history, trends surface as recommendations in cost-advise output.

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
- feature FEAT-002 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
