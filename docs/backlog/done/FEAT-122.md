---
id: FEAT-122
title: "TS Phase 5 — ESLint ratchet (complexity 10, max-lines-fn 30, max-lines 300)"
priority: P2
status: triaged
category: code-quality
target_release: null
autonomous_safe: false
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md
plan: null
related: [FEAT-121, FEAT-120]
phase: null
tags: ["concern:code-quality", "surface:tooling", "stack:typescript", "stack:eslint"]
pm_customer_impact: 0.3
pm_demand_signal: null
pm_technical_feasibility: 0.7
pm_scope_risk: 0.6
pm_strategic_alignment: 0.5
pm_composite: null
pm_legacy_demand_signal: null
pm_legacy_customer_impact: 0.2
pm_effort_estimate: 0.7
pm_technical_risk: 0.5
pm_dependency_depth: 0.4
updated: 2026-06-07
slices: []
slices_complete: []
triage_notes: "autonomous_safe=false: lint rule changes across entire codebase, may require manual waiver decisions"
depends_on: [FEAT-121]
github_issue: 108
github_milestone: null
github_url: "https://github.com/sergeymilashico/hero-crew/issues/108"
---
# FEAT-122 — TS Phase 5: ESLint ratchet

## Why

Remove per-file ESLint overrides and enforce repo-wide standards: complexity ≤10, max-lines-per-function ≤30, max-lines ≤300. Ban nested ternaries. Add `@typescript-eslint/no-floating-promises`, `import/no-default-export` on scripts/lib/**.

## Spec

`docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md` § Phase 5.

## Acceptance criteria

- [ ] AC-1: `eslint.config.mjs` tightened: complexity 10, max-lines-per-function 30, max-lines 300.
- [ ] AC-2: All violations fixed or waived with rationale comment.
- [ ] AC-3: `npm run lint` exits 0 (zero warnings).
- [ ] AC-4: `tsc --noEmit` clean.
- [ ] AC-5: All CI gates pass.

## Notes

- `autonomous_safe: false` — waiver decisions require human review.
- Depends on FEAT-121 (all test files migrated).
- Some `crew.ts` complexity violations may require refactor vs waiver.
