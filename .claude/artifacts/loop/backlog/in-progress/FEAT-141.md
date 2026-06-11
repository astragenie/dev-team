---
id: FEAT-141
status: in-progress
priority: P2
category: quality
target_release: null
created: 2026-06-10
updated: 2026-06-11
depends_on: []
slices: [SLICE-68]
derived_from: null
pm_customer_impact: 0.6
pm_effort_estimate: 0.6
pm_strategic_alignment: 0.75
pm_technical_risk: 0.55
pm_dependency_depth: 0.3
composite_score: 0.585
autonomous_safe: false
triage_notes: "via=pm retriage 2026-06-10 | FEAT body cites reliability+observability avg 0.74 each, but snapshot 5-grade avg = reliability 0.83 / observability 0.80 — neither hits weak-dim trigger (security 0.79 is the only weak dim). Customer_impact lowered to 0.60. observability is borderline (right at 0.80) — if it dips next grade, this becomes weak-dim work. Largest of the 6 pending FEATs: 3 bundled parts (deployment-patterns addition + review-gates addition + new observability domain skill) + reviewer/validator prompt rows. Risk band 0.55: new skill + 2 skill edits, new skill-tier classification rules apply; rollback per-component possible. autonomous_safe=false: skill+agent prompt authorship per CLAUDE.md governance. Scope challenge: consider splitting — observability skill alone could ship as its own slice if observability slips below 0.80 next grade window. Cost analog: FEAT-138 aggregate $102/12min is overstated (cross-repo); isolated 3-skill-edit slice expected $30-50."
started_at: 2026-06-11
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
