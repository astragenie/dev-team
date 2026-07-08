---
id: FEAT-200
status: triaged
priority: P2
category: feature
target_release: null
created: 2026-07-08
updated: 2026-07-08
depends_on: []
slices: []
derived_from: null
pm_customer_impact: 0.55
pm_effort_estimate: 0.35
pm_strategic_alignment: 0.5
pm_technical_risk: 0.45
pm_dependency_depth: 0.25
pm_composite_priority: P2
pm_autonomous_safe: false
pm_reviewed: 2026-07-08
autonomous_safe: false
triage_notes: "technical_risk 0.45, band 0.3-0.5 (new-to-repo sharding pattern, single CI workflow file, no data/schema change, clean revert). composite_score=0.565; neither P1 branch fires (impact 0.55 < 0.7; alignment 0.50 < 0.8) -> P2. autonomous_safe=false: no AC in the bare-prose FEAT body (P2, no --deep/--spec) trips the AC-clarity gate, and this directly edits .github/workflows/test.yml (CI-touching convention, same as FEAT-190's autonomous_safe:false precedent)."
---
## Description

Shard the test suite — split bun test by file-glob across N CI jobs to cut wall-clock. bun test runs single-process (no --parallel, bun#5090) so 1715 tests are slow every cycle and discourage local runs. Faster CI enables more stabilization iterations. Keep bun#5090 note; re-enable --parallel when fixed upstream.

## Intake notes

Created via free-text intake (`/runner:intake "<text>"`). Priority is
unset — this FEAT has not been scored yet. Run `/runner:triage`
(PM scoring + `backlog pm-apply`) to score it before slicing.