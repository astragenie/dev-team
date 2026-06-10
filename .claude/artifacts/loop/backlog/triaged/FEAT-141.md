---
id: FEAT-141
status: triaged
priority: P2
category: quality
target_release: null
created: 2026-06-10
updated: 2026-06-10
depends_on: []
slices: []
derived_from: null
pm_customer_impact: 0.78
pm_effort_estimate: 0.6
pm_strategic_alignment: 0.8
pm_technical_risk: 0.58
pm_dependency_depth: 0.3
composite_score: 0.67
autonomous_safe: false
triage_notes: "via=pm | \"Dual weak-dim target; moderate-high effort (3 bundled parts, 1 new skill); skill authorship => human review\""
---
# FEAT-141: Reliability + observability review lenses — rollback matrix, silent-failure hunt, observability guidance

## Description

Targets grade dimensions reliability (avg 0.74) and observability (avg 0.74).
Three bundled additions:

1. **Rollback decision matrix** in `skills/domain/deployment-patterns/`:
   severity x data impact x time-to-fix → rollback vs forward-fix. Gives the
   deployer structured criteria instead of unaided judgment under pressure
   (~20 lines).
2. **Silent-failure review lens** in `skills/workflow/review-gates/`: checklist
   items for swallowed errors, catch-and-continue without logging, inadequate
   fallbacks, and missing health-check tiers (liveness/readiness/startup) on
   runnable changes.
3. **Observability guidance skill** `skills/domain/observability/`: logging,
   tracing, and metrics expectations a builder must meet on runnable changes,
   phrased so the validator can cite them as evidence. Gap analysis confirmed
   nothing in the current skill tree covers observability-first design.

## Deliverables

- deployment-patterns skill addition (rollback matrix).
- review-gates skill addition (silent-failure checklist).
- New `skills/domain/observability/` skill + routing-table row.
- Reviewer + validator prompt rows referencing the new lenses.

Source patterns: claude-code-templates `deployment/rollback-deploy.md`,
`deployment/deployment-monitoring.md` (health-check hierarchy),
`performance/add-performance-monitoring.md`.
