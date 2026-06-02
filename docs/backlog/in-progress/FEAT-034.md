---
id: FEAT-034
title: Disambiguate aggregate vs per-slice cost reports
priority: P2
status: in-progress
category: performance
target_release: v0.5.0
created: 2026-06-01
updated: 2026-06-02
depends_on: []
slices: [SLICE-13]
derived_from: null
autonomous_safe: true
---

## Description

Every recent cost report has `aggregateAll: true` and
`sourceCount: 4–5`. The cost grade "F" surfaced in brief-me is driven
by the aggregate (114 redundant Reads, 49 subagent dispatches), but
the per-slice counts are 9 Reads and 6 dispatches. The aggregate sums
across sibling worktrees and prior sessions, so the cost-health
signal looks like a regression that isn't real. Split the cost-report
artifact into two clearly-labelled variants: `cost-report-slice`
(single session, the slice that just ran) and `cost-report-aggregate`
(rollup across worktrees / sessions). Brief-me grades only against
the per-slice variant.

## Acceptance hints

- `scripts/lib/cost-advisor.mjs` (and related emit paths) write two
  artifacts when both views are meaningful: one with
  `sourceProject: <project>`, `aggregateAll: false`; one with
  `aggregateAll: true`.
- Filename convention disambiguates: `cost-report-slice-<title>.md`
  vs `cost-report-aggregate-<title>.md`.
- `brief-me` `costHealth` field grades only the slice variant. The
  aggregate variant is surfaced in a separate `costAggregate` field
  or section for context.
- Existing single-variant cost reports continue to parse correctly
  (backward-compat read path).
- Tests cover: per-slice-only emission, both-variants emission,
  brief-me grade calculation against per-slice not aggregate.

## Notes

- Cosmetic but unblocks honest cost grading — current "F" grade is
  partly artifact aggregation noise.
- If investigation shows the 114-Read count is true regression, this
  jumps from P2 to P0 and FEAT-029's premise tightens (because the
  reread hook would already be cutting actual redundant reads, not
  just inflated aggregate counts).
- Source analysis: handoff `20260601T115349Z-...-awaiting-user-choice.md`.
