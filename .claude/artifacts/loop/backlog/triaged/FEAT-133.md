---
id: FEAT-133
title: "Quality: split briefing/collect.ts (712 lines, 3 concerns) into focused modules"
priority: P2
status: triaged
category: quality
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-08-plugin-perf-quality-10-design.md
plan: null
related: [FEAT-129]
phase: null
tags: ["stack:node", "stack:typescript", "concern:quality", "surface:scripts"]
pm_customer_impact: 0.5
pm_demand_signal: null
pm_technical_feasibility: null
pm_scope_risk: null
pm_strategic_alignment: 0.5
pm_composite: null
updated: 2026-06-08
created: 2026-06-08
triaged_at: null
triage_notes: "priority inferred as P2 from body content; autonomous_safe inferred: AC count=5, derived_from=null → true"
slices: []
depends_on: [FEAT-129]
github_issue: null
github_milestone: null
github_url: null
pm_legacy_demand_signal: null
pm_legacy_customer_impact: null
pm_effort_estimate: 0.5
pm_technical_risk: 0.5
pm_dependency_depth: 0.5
migration_note: legacy PM schema preserved as pm_legacy_*; new dimensions defaulted to 0.5 on 2026-06-08
---
## Description

`scripts/lib/briefing/collect.ts` is 712 lines handling 3 separate concerns: git log/branch, cost report parsing, and workflow state reads. Single responsibility violated.

## Acceptance Criteria

- Split into:
  - `scripts/lib/briefing/git.ts` — git log, branch, recent commits
  - `scripts/lib/briefing/cost.ts` — cost report parsing, model burn, cache metrics
  - `scripts/lib/briefing/workflow.ts` — workflow state, badges, artifact reads
  - `scripts/lib/briefing/collect.ts` — thin orchestrator importing from the 3 modules
- Each new file ≤ 250 lines; orchestrator ≤ 80 lines
- All existing briefing tests pass; no output change
- `npm run lint` clean (no new max-lines violations)
- Sequence after FEAT-129 (parallel collection changes) to avoid merge conflict
