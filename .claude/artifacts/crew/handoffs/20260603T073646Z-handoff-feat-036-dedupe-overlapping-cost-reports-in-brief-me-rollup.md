# Task Handoff: FEAT-036: Dedupe overlapping cost reports in brief-me rollup

- Created: 2026-06-03T07:36:46.091Z
- From: builder
- To: lead
- Objective: collectRecentCosts now deduplicates overlapping cost-report windows before computing sumUsdRecent, avgUsdRecent, and modelBurn, fixing the 3,774 triple-count shown in the 2026-06-03 brief-me.
- Allowed Scope:
  - scripts/lib/briefing/collect.mjs (dedupeForRollup + collectRecentCosts)
  - scripts/lib/briefing.mjs (summary.costReports)
  - tests/briefing-cost-rollup-dedupe.test.mjs
  - CHANGELOG.md
- Forbidden Scope: -
- Deliverable: dedupeForRollup() helper + updated collectRecentCosts + costs.dedupedCount field + briefing.mjs summary fix + 8 TDD tests (229→237 passing) + CHANGELOG v0.7.1 entry
- Changed Files:
  - scripts/lib/briefing/collect.mjs
  - scripts/lib/briefing.mjs
  - tests/briefing-cost-rollup-dedupe.test.mjs
  - CHANGELOG.md
- Confidence: high
- Risks: none
- Suggested Next Handoff: none

