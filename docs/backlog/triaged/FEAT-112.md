---
id: FEAT-112
title: TS Phase 1.7 — migrate installer leaf modules to .ts
priority: P1
status: triaged
category: code-quality
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md
plan: null
related: [FEAT-100, FEAT-106, FEAT-107, FEAT-108, FEAT-109, FEAT-110, FEAT-111, FEAT-113]
phase: null
tags: ["concern:code-quality", "surface:tooling", "stack:typescript", "stack:node"]
pm_customer_impact: 0.5
pm_demand_signal: null
pm_technical_feasibility: 0.9
pm_scope_risk: 0.2
pm_strategic_alignment: 0.5
pm_composite: null
pm_legacy_demand_signal: null
pm_legacy_customer_impact: 0.4
pm_effort_estimate: 0.5
pm_technical_risk: 0.5
pm_dependency_depth: 0.5
migration_note: legacy PM schema preserved as pm_legacy_*; new dimensions defaulted to 0.5 on 2026-06-07
triage_notes: "autonomous_safe inferred: AC count=7, derived_from=null → true"
updated: 2026-06-07
slices: []
slices_complete: []
---
# FEAT-112 — TS Phase 1.7: installer leaf modules

## Why

Migrate 4 small installer leaf modules. These are pure utility files with
simple string-manipulation responsibilities — low risk, high type safety gain.

## Spec

`docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md` § Phase 1, slice 1.7.

## Acceptance criteria

- [ ] AC-1: `scripts/lib/installer/util.mjs` renamed to `.ts`; imports updated.
- [ ] AC-2: `scripts/lib/installer/gitignore.mjs` renamed to `.ts`; imports updated.
- [ ] AC-3: `scripts/lib/installer/templates.mjs` renamed to `.ts`; imports updated.
- [ ] AC-4: `scripts/lib/installer/welcome.mjs` renamed to `.ts`; imports updated.
- [ ] AC-5: Explicit TypeScript types; no `any`; `tsc --noEmit` clean.
- [ ] AC-6: Dead code removed.
- [ ] AC-7: All CI gates pass.

## Notes

- Per-slice protocol from spec.
- Sets up clean interfaces for installer core migration (FEAT-113).
