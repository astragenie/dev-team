---
id: FEAT-027
title: Regression trend detectors in cost-advisor
priority: P2
status: done
category: feature
target_release: null
created: 2026-05-27
updated: 2026-05-27
depends_on: [FEAT-026]
slices: []
derived_from: null
autonomous_safe: true
---
## Description

Three new trend signals comparing last 3 slices:
1. Compaction drift — compaction count trending upward
2. Subagent creep — dispatch count growing
3. Cost regression — USD/slice increasing >20%

## Acceptance hints

- Each trend detector fires when comparing last 3 cost reports
- Trends surface as recommendations in cost-advise output
- Test covers each trend with synthetic 3-report history
- File: `scripts/lib/cost-advisor.mjs`
