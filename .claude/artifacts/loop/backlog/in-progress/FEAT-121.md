---
id: FEAT-121
title: TS Phase 4.2 — tests batch 2 migration (21 test files .mjs → .ts)
priority: P1
status: in-progress
category: code-quality
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md
plan: null
related: [FEAT-120, FEAT-119]
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
updated: 2026-06-07
slices: [SLICE-45]
slices_complete: []
triage_notes: "autonomous_safe inferred: AC count=5, derived_from=parent_spec → true"
depends_on: [FEAT-120]
started_at: 2026-06-07
---
# FEAT-121 — TS Phase 4.2: tests batch 2 migration

## Why

Rename remaining 21 test files from `.mjs` to `.ts`. Completes Phase 4 — all test files now TypeScript.

## Spec

`docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md` § Phase 4, slice 4.2.

## Files in scope

1. `tests/fs-utils.test.mjs`
2. `tests/hook-error-events.test.mjs`
3. `tests/installer.test.mjs`
4. `tests/integration-smoke-skill.test.mjs`
5. `tests/integrator-prompt.test.mjs`
6. `tests/journey-builder.test.mjs`
7. `tests/jsonl.test.mjs`
8. `tests/orchestrate-slice.test.mjs`
9. `tests/preflight-shell.test.mjs`
10. `tests/regression.test.mjs`
11. `tests/scope-estimate.test.mjs`
12. `tests/subagent-return.test.mjs`
13. `tests/ux-validation-integration.test.mjs`
14. `tests/ux-validation.test.mjs`
15. `tests/validate-agents.test.mjs`
16. `tests/validate-contracts.test.mjs`
17. `tests/validate-routing-table.test.mjs`
18. `tests/validate-skills.test.mjs`
19. `tests/validate-slices.test.mjs`
20. `tests/validate-syntheses.test.mjs`
21. `tests/validate-ux-spec.test.mjs`

## Acceptance criteria

- [ ] AC-1: All 21 remaining `.mjs` test files renamed to `.ts`.
- [ ] AC-2: No `.mjs` test files remain in `tests/`.
- [ ] AC-3: No `any`; `tsc --noEmit` clean.
- [ ] AC-4: All existing tests pass (same count, minus WSL pre-existing failures).
- [ ] AC-5: All CI gates pass.

## Notes

- Depends on FEAT-120 (batch 1) completing first.
- After this FEAT, `tests/` contains only `.ts` files. Update Prettier/ESLint globs accordingly.
