---
id: FEAT-029
title: Promote cost-hygiene reread hook to default-on
priority: P2
status: triaged
category: performance
target_release: null
created: 2026-06-01
updated: 2026-06-08
depends_on: []
slices: []
derived_from: null
autonomous_safe: true
deferred: false
cross_repo: null
parent_spec: "docs/superpowers/specs/2026-06-08-plugin-perf-quality-10-design.md"
plan: null
related: []
phase: null
tags: ["stack:node", "concern:performance", "surface:hooks"]
pm_customer_impact: null
pm_demand_signal: null
pm_technical_feasibility: null
pm_scope_risk: null
pm_strategic_alignment: null
pm_composite: null
triaged_at: 2026-06-08
triage_notes: "Re-opened 2026-06-08: undeferred, autonomous_safe promoted to true (pure config change — flip hook default, keep opt-out env var). Originally P0 from 2026-06-01."
github_issue: 37
github_milestone: null
github_url: "https://github.com/sergeymilashico/hero-crew/issues/37"
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
