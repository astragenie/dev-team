---
id: FEAT-139
status: pending
priority: null
category: quality
target_release: null
created: 2026-06-09
updated: 2026-06-09
depends_on: []
slices: []
derived_from: null
---
# FEAT-139: qa-expert test-quality lens: flaky-test detection + mutation-testing quality bar

Targets the weakest grade dimension (test_confidence avg 0.72). Enrich qa-expert with a test-quality analysis lens beyond line coverage: (1) flaky-test detection heuristics — shared state, unawaited async, time/order dependence, retry-masked failures; (2) test anti-pattern scan — assertion-free tests, over-mocking, tautological asserts; (3) optional mutation-testing quality bar for critical paths (survival analysis as evidence, gate stays advisory). Deliverables: new workflow skill (test-quality), qa-expert prompt rows routing to it, routing-table row "test suite quality questioned / coverage adequate but confidence low". Source patterns: claude-code-templates testing/test-quality-analyzer.md and add-mutation-testing.md.
