---
id: FEAT-135
title: "Quality: promote validate-routing-table.ts from advisory to hard CI gate"
priority: null
status: pending
category: quality
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: "docs/superpowers/specs/2026-06-08-plugin-perf-quality-10-design.md"
plan: null
related: []
phase: null
tags: ["stack:ci", "concern:quality", "surface:ci"]
pm_customer_impact: null
pm_demand_signal: null
pm_technical_feasibility: null
pm_scope_risk: null
pm_strategic_alignment: null
pm_composite: null
updated: 2026-06-08
created: 2026-06-08
triaged_at: null
triage_notes: null
slices: []
depends_on: []
github_issue: null
github_milestone: null
github_url: null
---
## Description

`.github/workflows/test.yml` runs `validate-routing-table.ts` with `continue-on-error: true` — routing violations don't fail CI. This is advisory-only, meaning routing drift goes undetected.

## Acceptance Criteria

- Confirm `validate-routing-table.ts` exits 0 on current `main` before making any change
- Remove `continue-on-error: true` from the `validate-routing-table` CI step
- No other CI step changed
- Document: a deliberate routing-table violation tested locally causes CI step to fail
