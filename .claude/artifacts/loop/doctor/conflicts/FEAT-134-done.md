---
id: FEAT-134
title: "Quality: extract pure functions from session-cost-scanner.ts"
priority: P2
status: done
category: quality
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-08-plugin-perf-quality-10-design.md
plan: null
related: []
phase: null
tags: ["stack:node", "stack:typescript", "concern:quality", "surface:scripts"]
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

`scripts/lib/session-cost-scanner.ts` (582 lines) mixes pure computation (token aggregation, model-burn accumulation, cache hit calculation) with I/O — making pure logic hard to unit-test.

## Acceptance Criteria

- Identify pure functions (no `fs`, no side effects) in `session-cost-scanner.ts`
- Extract to `scripts/lib/session-cost-scanner/compute.ts`
- `session-cost-scanner.ts` becomes thin I/O wrapper calling compute functions
- Extracted functions have no I/O dependencies — testable without mocks
- Unit tests for pure functions (input → expected output, no file I/O)
- Existing integration tests for scanner pass
- `npm run typecheck` + `npm run lint` clean
