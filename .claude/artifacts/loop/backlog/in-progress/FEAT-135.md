---
id: FEAT-135
title: "Quality: promote validate-routing-table.ts from advisory to hard CI gate"
priority: P2
status: in-progress
category: quality
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-08-plugin-perf-quality-10-design.md
plan: null
related: []
phase: null
tags: ["stack:ci", "concern:quality", "surface:ci"]
pm_customer_impact: 0.5
pm_demand_signal: null
pm_technical_feasibility: null
pm_scope_risk: null
pm_strategic_alignment: 0.5
pm_composite: null
updated: 2026-06-08
created: 2026-06-08
triaged_at: null
triage_notes: "priority inferred as P2 from body content; autonomous_safe inferred: AC count=4, derived_from=null → true"
slices: [SLICE-62]
depends_on: []
github_issue: null
github_milestone: null
github_url: null
pm_legacy_demand_signal: null
pm_legacy_customer_impact: null
pm_effort_estimate: 0.5
pm_technical_risk: 0.5
pm_dependency_depth: 0.5
migration_note: legacy PM schema preserved as pm_legacy_*; new dimensions defaulted to 0.5 on 2026-06-08
started_at: 2026-06-08
---
## Description

`.github/workflows/test.yml` runs `validate-routing-table.ts` with `continue-on-error: true` — routing violations don't fail CI. This is advisory-only, meaning routing drift goes undetected.

## Acceptance Criteria

- Confirm `validate-routing-table.ts` exits 0 on current `main` before making any change
- Remove `continue-on-error: true` from the `validate-routing-table` CI step
- No other CI step changed
- Document: a deliberate routing-table violation tested locally causes CI step to fail
