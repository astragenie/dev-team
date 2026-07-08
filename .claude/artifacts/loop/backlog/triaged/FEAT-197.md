---
id: FEAT-197
status: triaged
priority: P2
category: feature
target_release: null
created: 2026-07-08
updated: 2026-07-08
depends_on: []
slices: []
derived_from: null
pm_customer_impact: 0.6
pm_effort_estimate: 0.55
pm_strategic_alignment: 0.75
pm_technical_risk: 0.45
pm_dependency_depth: 0.3
pm_composite_priority: P2
pm_autonomous_safe: false
pm_reviewed: 2026-07-08
autonomous_safe: false
triage_notes: "technical_risk 0.45, band 0.3-0.5 (new e2e pattern in repo -- orchestrating the full ceremony has no existing analog -- but test-only, no schema/contract change, clean git revert). composite_score=0.615; neither P1 branch fires (impact 0.60 < 0.7; alignment 0.75 < 0.8) -> P2. autonomous_safe=false: no explicit AC in the FEAT body (P2, no --deep/--spec passed, so PM does not draft AC this pass) -- AC-clarity gate trips regardless of numeric scores."
---
## Description

Full slice-ceremony e2e — drive the whole ceremony (slice start to build to review to validate to close) against the sample/temp repo and assert: artifacts land in .claude/artifacts/crew, workflow-state currentRun rotates, cost attribution attaches, and slice file moves to completed. Catches ceremony regressions that unit tests miss today.

## Intake notes

Created via free-text intake (`/runner:intake "<text>"`). Priority is
unset — this FEAT has not been scored yet. Run `/runner:triage`
(PM scoring + `backlog pm-apply`) to score it before slicing.