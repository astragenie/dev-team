---
id: FEAT-129
title: "Perf: parallelize independent data collection branches in briefing/collect.ts"
priority: P2
status: done
category: performance
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-08-plugin-perf-quality-10-design.md
plan: null
related: [FEAT-133]
phase: null
tags: ["stack:node", "concern:performance", "surface:scripts"]
pm_customer_impact: null
pm_demand_signal: null
pm_technical_feasibility: null
pm_scope_risk: null
pm_strategic_alignment: null
pm_composite: null
updated: 2026-06-08
created: 2026-06-08
triaged_at: 2026-06-08
triage_notes: "regex-fallback P2; autonomous_safe=true: pure script change, AC count >= 4"
slices: []
depends_on: []
github_issue: null
github_milestone: null
github_url: null
completed_at: 2026-06-08
---
## Description

Top-level data collection calls in `scripts/lib/briefing/collect.ts` (git log, cost report reads, workflow state reads) are sequential despite having no data dependencies on each other.

## Acceptance Criteria

- Audit `collect.ts` for independent top-level async calls
- Wrap independent branches in `Promise.all`; preserve any dependency order where it exists
- No output change — same briefing content, lower latency
- All existing briefing tests pass
- `npm run typecheck` + `npm run lint` clean
