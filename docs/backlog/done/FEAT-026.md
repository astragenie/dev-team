---
id: FEAT-026
title: Performance letter grades (A-F) in cost-advisor
priority: P2
status: done
category: feature
target_release: null
created: 2026-05-27
updated: 2026-05-27
depends_on: []
slices: []
derived_from: null
autonomous_safe: true
---
## Description

Compute composite A-F grade from: compaction count, subagent count, re-read count, tool failure rate, cache hit %. Surface in cost-advise artifacts.

## Acceptance hints

- `buildCostAdvisor` returns a `grade` field (A-F string)
- Grade appears in cost-advise markdown output
- Grade thresholds documented in code
- Test covers grade computation for known metric combos
- File: `scripts/lib/cost-advisor.mjs`
