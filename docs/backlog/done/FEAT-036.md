---
id: FEAT-036
title: Dedupe overlapping cost reports in brief-me cost rollup
priority: P2
status: done
category: observability
target_release: v0.7.1
created: 2026-06-03
updated: 2026-06-03
depends_on: []
slices: []
derived_from: null
autonomous_safe: true
---

## Description

`collectRecentCosts` in `scripts/lib/briefing/collect.mjs:665` blindly
sums `report.usd` across the 5 newest cost-report files. The recency
list mixes three classes of report that cover the same wall-clock
window:

1. `aggregate` snapshots (`sourceProject: "aggregate"`,
   `aggregateAll: true`) — full-fleet meter readings taken at
   different checkpoints of the same multi-day window. Each new
   snapshot supersedes the previous one; old snapshots are stale
   redrafts of the same number, not additive spend.
2. `slice` reports (`sourceProject: "C--work-mega-hero-crew"`,
   `aggregateAll: false`) — single-project subsets of the aggregate
   row. Double-counted when an aggregate row covering the same
   window is also in the list.
3. Legitimately-distinct historical reports (different
   `windowStart`/`windowEnd`).

Today's `/crew:brief-me` output showed five reports adding to
`sumUsdRecent: $13,774.62` for a 5.27-day window where the latest
aggregate snapshot was $3,995.81. The $13,774 figure is arithmetically
correct but semantically wrong: it triple-counts the same fleet meter
and double-counts hero-crew's slice within it. Same flaw affects
`modelBurn` (`slices: 5` for opus across what is really one window
read three times + one project's slice read twice).

The brief-me cost table already renders each report row independently
which is fine. The bug is the **summary aggregate** under `costs.*`
that downstream consumers (and the autonomousLoop costs block in the
brief) treat as a real number.

## Acceptance hints

- Within a recency window, classify each cost report by
  `(sourceProject, aggregateAll, windowStart, windowEnd)`.
- For each `windowStart→windowEnd` bucket, pick **one** canonical
  report:
  - prefer the latest `aggregate` snapshot for the bucket if any
    aggregate row exists;
  - else fall back to the latest slice report;
  - discard older readings of the same `(scope, window)` pair from
    the sum.
- Slice rows whose window is fully contained inside a chosen
  aggregate row are **omitted** from `sumUsdRecent` /
  `modelBurn` to prevent double-counting (their cost is already
  inside the aggregate). Keep them in the `recent[]` array for the
  per-row table render — only the rollup is deduped.
- `sumUsdRecent`, `avgUsdRecent`, `modelBurn` recomputed over the
  deduped set. `avgUsdRecent` divides by the deduped count, not
  raw count.
- New field `costs.dedupedCount` exposes how many of the
  `totalReports` rows actually contributed to the sum, so the brief
  can render "$X across N distinct slices (Y reports filtered as
  overlapping)".
- Tests cover: (a) all-aggregate same window → sum equals latest
  aggregate alone; (b) aggregate + nested slice same window → sum
  equals aggregate alone; (c) disjoint historical windows → sum
  equals plain sum; (d) mix of overlapping aggregate, contained
  slice, and one disjoint historical report → sum equals latest
  aggregate + disjoint report; (e) `modelBurn` rollup respects the
  dedupe.
- `scripts/lib/briefing.mjs` view layer adopts the new `dedupedCount`
  field where it currently displays `totalReports`.
- CHANGELOG entry under v0.7.1.

## Notes

- `autonomous_safe: true` — pure refactor of one collector function
  plus tests; no agent-prompt edits and no skill authorship.
- Adjacent improvement (out of scope unless trivial): warn in the
  brief when the recency window is dominated by aggregate snapshots
  from a single multi-day run (suggests the user has not run
  `crew cost-report` per-slice and is missing per-slice granularity).
- Surfaced from the 2026-06-03 brief-me reading where the user asked
  "how is $13,000 even possible" — the answer is "it isn't, the sum
  triple-counts a $4k window."
