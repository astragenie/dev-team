---
id: FEAT-201
status: triaged
priority: P2
category: feature
target_release: null
created: 2026-07-08
updated: 2026-07-08
depends_on: []
slices: []
derived_from: null
pm_customer_impact: 0.65
pm_effort_estimate: 0.25
pm_strategic_alignment: 0.7
pm_technical_risk: 0.3
pm_dependency_depth: 0.3
pm_composite_priority: P2
pm_autonomous_safe: false
pm_reviewed: 2026-07-08
autonomous_safe: false
triage_notes: "technical_risk 0.30, band 0.3-0.5 (extends an existing, already-merged script (drift-check.ts) into a new CI/scheduled step -- new wiring pattern but no schema change, clean revert). composite_score=0.6925; neither P1 branch fires (impact 0.65 < 0.7; alignment 0.70 < 0.8) -> P2. autonomous_safe=false: no AC in the bare-prose FEAT body (P2, no --deep/--spec) trips the AC-clarity gate, and this wires into CI-or-scheduled-job config (CI-touching convention)."
---
## Description

Wire dual-write drift-check as a gate — run scripts/lib/memory/drift-check.ts in CI or a scheduled job with a drift threshold, and add an e2e asserting both stores land on dualWrite:true. astramem writes are fire-and-forget so the source-of-truth can silently fall behind the JSONL duplicate; this surfaces drift instead of hiding it.

## Intake notes

Created via free-text intake (`/runner:intake "<text>"`). Priority is
unset — this FEAT has not been scored yet. Run `/runner:triage`
(PM scoring + `backlog pm-apply`) to score it before slicing.