---
id: FEAT-120
title: TS Phase 4.1 — tests batch 1 migration (22 test files .mjs → .ts)
priority: P1
status: done
category: code-quality
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md
plan: null
related: [FEAT-119, FEAT-118]
phase: null
tags: ["concern:code-quality", "surface:tooling", "stack:typescript", "stack:node"]
pm_customer_impact: 0.4
pm_demand_signal: null
pm_technical_feasibility: 0.9
pm_scope_risk: 0.2
pm_strategic_alignment: 0.5
pm_composite: null
pm_legacy_demand_signal: null
pm_legacy_customer_impact: 0.3
pm_effort_estimate: 0.5
pm_technical_risk: 0.3
pm_dependency_depth: 0.3
updated: 2026-06-10
slices: [SLICE-44]
slices_complete: [SLICE-44]
triage_notes: "autonomous_safe inferred: AC count=5, derived_from=parent_spec → true"
started_at: 2026-06-07
github_issue: 105
github_milestone: null
github_url: "https://github.com/sergeymilashico/hero-crew/issues/105"
created: 2026-06-10
depends_on: []
completed_at: 2026-06-10
---
# FEAT-120 — TS Phase 4.1: tests batch 1 migration

## Why

Rename first 22 test files from `.mjs` to `.ts`. Adds TypeScript strict annotations to test code. Ensures all test imports reference `.ts` sources consistently.

## Spec

`docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md` § Phase 4, slice 4.1.

## Files in scope

1. `tests/agent-prompt-content.test.mjs`
2. `tests/agent-topology.test.mjs`
3. `tests/architect-feature.test.mjs`
4. `tests/artifact-cache.test.mjs`
5. `tests/brief-me-hook-health.test.mjs`
6. `tests/briefing-cost-health.test.mjs`
7. `tests/briefing-cost-rollup-dedupe.test.mjs`
8. `tests/builder-be-prompt.test.mjs`
9. `tests/builder-fe-prompt.test.mjs`
10. `tests/cli.test.mjs`
11. `tests/collect-hook-health.test.mjs`
12. `tests/collect-model-compliance.test.mjs`
13. `tests/cost-advisor-grade.test.mjs`
14. `tests/cost-advisor-trends.test.mjs`
15. `tests/cost-hygiene-decide.test.mjs`
16. `tests/cost-hygiene-hook.test.mjs`
17. `tests/cost-hygiene-state.test.mjs`
18. `tests/cost-report-emission.test.mjs`
19. `tests/cost-report-role-breakdown.test.mjs`
20. `tests/crew-write-review-result.test.mjs`
21. `tests/dir-cache.test.mjs`
22. `tests/fleet.test.mjs`

## Acceptance criteria

- [ ] AC-1: All 22 `.mjs` test files renamed to `.ts`.
- [ ] AC-2: `node --test --experimental-strip-types` discovers and runs `.ts` test files correctly.
- [ ] AC-3: No `any`; `tsc --noEmit` clean.
- [ ] AC-4: All existing tests pass (same count as before, minus WSL pre-existing failures).
- [ ] AC-5: All CI gates pass.

## Notes

- Use `node --test --experimental-strip-types` — no glob change needed; Node v24 discovers `.ts` test files natively.
- If Node test runner doesn't auto-discover `.ts` files, may need to add explicit glob to `npm test` script.
- Test files may import from scripts/*.ts or hooks/*.ts — import paths should already be correct.
- Rename only; don't add TypeScript annotations beyond what's needed to pass tsc.
