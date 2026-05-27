---
id: FEAT-001
status: in-progress
priority: P2
category: feature
target_release: null
created: 2026-05-27
updated: 2026-05-27
depends_on: []
slices: [SLICE-05]
derived_from: null
triage_notes: no fields needed inference
started_at: 2026-05-27
---
# FEAT-001: Performance letter grades (A-F) in cost-advisor

Compute composite A-F grade from: compaction count, subagent count, re-read count, tool failure rate, cache hit %. Surface in cost-advise artifacts. File: scripts/lib/cost-advisor.mjs. AC: buildCostAdvisor returns grade field, grade in markdown output, thresholds documented, test covers grade computation.