---
id: FEAT-008
status: done
priority: P2
category: governance
target_release: v0.3.0
created: 2026-05-22
updated: 2026-05-22
completed: 2026-05-22
depends_on: [FEAT-002]
slices: []
derived_from: null
autonomous_safe: true
phase: 1
github_issue: 8
github_milestone: 1
---
# FEAT-008: Routing-table review cadence

## Description

Add a brief-me reminder that surfaces when `docs/routing-table.md` is
older than 30 days. Encourages a monthly cross-check against
`.claude/artifacts/crew/runs/` for misroutes.

## Acceptance hints

- `brief-me` reports `routingTableStale: true` when mtime > 30 days.
- `recommendedNextStep` rule emits "Review routing-table.md against
  last 30 runs" when stale.
- No automatic edits to the table — review is human work.
