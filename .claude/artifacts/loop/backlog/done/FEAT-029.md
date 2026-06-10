---
id: FEAT-029
title: Promote cost-hygiene reread hook to default-on
priority: P2
status: done
category: performance
target_release: null
created: 2026-06-01
updated: 2026-06-10
depends_on: []
slices: [SLICE-54]
derived_from: null
autonomous_safe: true
deferred: false
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-08-plugin-perf-quality-10-design.md
plan: null
related: []
phase: null
tags: ["stack:node", "concern:performance", "surface:hooks"]
pm_customer_impact: 0.5
pm_demand_signal: null
pm_technical_feasibility: null
pm_scope_risk: null
pm_strategic_alignment: 0.5
pm_composite: null
triaged_at: null
triage_notes: "priority inferred as P2 from body content; autonomous_safe inferred: AC count=6, derived_from=null → true"
github_issue: 37
github_milestone: null
github_url: "https://github.com/sergeymilashico/hero-crew/issues/37"
pm_legacy_demand_signal: null
pm_legacy_customer_impact: null
pm_effort_estimate: 0.5
pm_technical_risk: 0.5
pm_dependency_depth: 0.5
migration_note: legacy PM schema preserved as pm_legacy_*; new dimensions defaulted to 0.5 on 2026-06-08
started_at: 2026-06-08
slices_complete: [SLICE-54]
completed_at: 2026-06-10
---
## Description

The cost-hygiene reread hook shipped opt-in (env-var gated). Aggregate cost reports show 114 redundant Read calls per slice. Promoting to default-on cuts that waste for every consumer install.

## Acceptance Criteria

- Locate hook config (`.claude/hooks/` or equivalent)
- Flip default: hook fires without any env var set
- Keep opt-out: `CREW_REREAD_HOOK=0` (or current env var name) disables
- Update any docs describing it as opt-in
- `e2e-smoke` confirms fresh repo install picks up default-on behavior without setting env var
- `node --test` passes
