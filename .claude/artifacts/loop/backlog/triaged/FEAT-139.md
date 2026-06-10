---
id: FEAT-139
status: triaged
priority: P2
category: quality
target_release: null
created: 2026-06-09
updated: 2026-06-10
depends_on: []
slices: []
derived_from: null
pm_customer_impact: 0.55
pm_effort_estimate: 0.55
pm_strategic_alignment: 0.70
pm_technical_risk: 0.50
pm_dependency_depth: 0.20
composite_score: 0.585
autonomous_safe: false
triage_notes: "via=pm retriage 2026-06-10 | FEAT body cites test_confidence avg 0.72, but current 5-grade snapshot avg = 0.806 (above weak-dim 0.80 bar) — demand softened, customer_impact lowered to 0.55. Coverage gap still real but no longer the most-bleeding edge (security at 0.79 now is). Risk band 0.5: new workflow skill ≤200 lines + qa-expert agent rows; prompt-design risk, not code risk; rollback trivial. autonomous_safe=false: skill+agent prompt authorship per CLAUDE.md governance. Cost analog: SLICE-64 prompt-only $1.88/11.6min — effort 0.55 confirmed (3 bundled lenses: flaky-test + anti-pattern + mutation). Pre-mortem: silent-failure risk = lens fires false positives, reviewer learns to ignore — AC must include calibration evidence (e.g. signal-noise spot-check on N past slices)."
---
# FEAT-139: qa-expert test-quality lens: flaky-test detection + mutation-testing quality bar

Targets the weakest grade dimension (test_confidence avg 0.72). Enrich qa-expert with a test-quality analysis lens beyond line coverage: (1) flaky-test detection heuristics — shared state, unawaited async, time/order dependence, retry-masked failures; (2) test anti-pattern scan — assertion-free tests, over-mocking, tautological asserts; (3) optional mutation-testing quality bar for critical paths (survival analysis as evidence, gate stays advisory). Deliverables: new workflow skill (test-quality), qa-expert prompt rows routing to it, routing-table row "test suite quality questioned / coverage adequate but confidence low". Source patterns: claude-code-templates testing/test-quality-analyzer.md and add-mutation-testing.md.
