---
id: FEAT-119
title: TS Phase 3.2 — hooks migration (hooks/*.mjs → .ts)
priority: P1
status: triaged
category: code-quality
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md
plan: null
related: [FEAT-118]
phase: null
tags: ["concern:code-quality", "surface:tooling", "stack:typescript", "stack:node"]
pm_customer_impact: 0.5
pm_demand_signal: null
pm_technical_feasibility: 0.8
pm_scope_risk: 0.3
pm_strategic_alignment: 0.5
pm_composite: null
pm_legacy_demand_signal: null
pm_legacy_customer_impact: 0.4
pm_effort_estimate: 0.5
pm_technical_risk: 0.5
pm_dependency_depth: 0.5
updated: 2026-06-07
slices: []
slices_complete: []
migration_note: legacy PM schema preserved as pm_legacy_*; new dimensions defaulted to 0.5 on 2026-06-07
triage_notes: "autonomous_safe inferred: AC count=5, derived_from=null → true"
---
# FEAT-119 — TS Phase 3.2: hooks migration

## Why

Rename plugin-distributed `hooks/*.mjs` to `.ts`. Update `hooks/hooks.json` path references. Repo-local `.claude/hooks/*.sh` are untouched (bash, not JS).

## Spec

`docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md` § Phase 3, slice 3.2.

## Acceptance criteria

- [ ] AC-1: All `hooks/*.mjs` files renamed to `.ts`.
- [ ] AC-2: `hooks/hooks.json` path references updated to `.ts`.
- [ ] AC-3: No `any`; `tsc --noEmit` clean.
- [ ] AC-4: Functions >30 body lines split.
- [ ] AC-5: All CI gates pass.

## Notes

- Depends on FEAT-118 (entrypoint cutover done first for context consistency).
- hooks.json path refs are critical — wrong paths break hook execution entirely.
