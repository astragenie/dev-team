---
id: FEAT-003
status: in-progress
priority: P2
category: feature
target_release: null
created: 2026-05-27
updated: 2026-05-27
depends_on: []
slices: [SLICE-07]
derived_from: null
triage_notes: no fields needed inference
started_at: 2026-05-27
---
# FEAT-003: Cost health summary in brief-me output

When recent cost reports exist, surface one-line health summary in brief-me: grade + top concern. AC: brief-me JSON includes costHealth field, contains grade (A-F) and topConcern, no field when no cost reports, test covers both cases. File: scripts/lib/briefing/collect.mjs.