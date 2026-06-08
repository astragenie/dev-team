---
id: FEAT-044
title: Complexity debt reduction — extract suppressed functions + split oversized modules
priority: P1
status: done
category: quality
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-05-plugin-performance-stability-design.md
plan: docs/superpowers/plans/2026-06-05-feat-a-complexity-debt.md
related: [FEAT-043, FEAT-045, FEAT-046]
phase: null
tags: ["concern:architecture", "surface:cli"]
pm_customer_impact: 0.65
pm_demand_signal: 0.75
pm_technical_feasibility: 0.9
pm_scope_risk: 0.8
pm_strategic_alignment: 0.8
pm_composite: 0.78
github_issue: 60
github_milestone: null
github_url: "https://github.com/sergeymilashico/hero-crew/issues/60"
---
# FEAT-044 — Complexity debt reduction

## Why

Three functions in `crew.mjs` and `artifacts.mjs` carry acknowledged complexity debt
from SLICE-13 suppressed with `eslint-disable-next-line complexity`. Five library files
exceed 700 lines — a documented cause of the SLICE-13 builder context ceiling at
50 tool uses / 91k tokens. Pure structural extraction with no behavior change.

## Spec

`docs/superpowers/specs/2026-06-05-plugin-performance-stability-design.md` → FEAT-A

## Acceptance criteria

- [x] AC-1: Zero `eslint-disable-next-line complexity` suppressions remain in `crew.mjs` and `artifacts.mjs`
- [x] AC-2: ESLint complexity passes on all 3 previously-suppressed functions without suppression
- [x] AC-3: `collect.mjs` < 600L; `cost-advisor.mjs` < 500L; `session-cost.mjs` < 500L; `workflow-state.mjs` < 500L
- [x] AC-4: All existing tests pass (no behavior change); `npm run lint` zero warnings
- [x] AC-5: `scripts/lib/cost-hygiene/` contains extracted helpers as named exports
