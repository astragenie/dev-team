---
id: FEAT-028
title: Cost health summary in brief-me output
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
phase: 1
github_issue: 32
github_milestone: 1
---
## Description

When recent cost reports exist, surface a one-line health summary in brief-me: grade + top concern.

## Acceptance hints

- brief-me JSON includes `costHealth` field when cost reports exist
- `costHealth` contains `grade` (A-F) and `topConcern` (string or null)
- No costHealth field when no cost reports exist (backward compat)
- Test covers brief-me with/without cost reports
- File: `scripts/lib/briefing/collect.mjs` or `scripts/lib/briefing.mjs`
