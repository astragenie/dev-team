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
plan: .claude/artifacts/loop/slice-specs/FEAT-133-slice-spec.md
related: [FEAT-129]
phase: null
tags: ["stack:node", "stack:typescript", "concern:quality", "surface:scripts"]
pm_customer_impact: 0.6
pm_demand_signal: null
pm_technical_feasibility: null
pm_scope_risk: null
pm_strategic_alignment: 0.65
pm_composite: null
updated: 2026-06-10
created: 2026-06-08
triaged_at: null
triage_notes: "via=pm retriage w/ spec. autonomous_safe true: pure behavior-preserving source refactor, no agent/skill/command prompt edits. Reviewed spec removed collectAll scope creep; golden-snapshot characterization test. Low technical_risk."
slices: []
depends_on: [FEAT-129]
github_issue: null
github_milestone: null
github_url: null
pm_legacy_demand_signal: null
pm_legacy_customer_impact: null
pm_effort_estimate: 0.45
pm_technical_risk: 0.25
pm_dependency_depth: 0.1
migration_note: legacy PM schema preserved as pm_legacy_*; new dimensions defaulted to 0.5 on 2026-06-08
composite_score: 0.635
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
