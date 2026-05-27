---
id: FEAT-002
status: in-progress
priority: P2
category: feature
target_release: null
created: 2026-05-27
updated: 2026-05-27
depends_on: []
slices: [SLICE-06]
derived_from: null
triage_notes: no fields needed inference
started_at: 2026-05-27
---
# FEAT-002: Regression trend detectors in cost-advisor

Three new trend signals comparing last 3 slices: (1) compaction drift trending upward, (2) subagent creep dispatch count growing, (3) cost regression USD/slice increasing >20%. File: scripts/lib/cost-advisor.mjs. AC: each trend fires on synthetic 3-report history, trends surface as recommendations in cost-advise output.