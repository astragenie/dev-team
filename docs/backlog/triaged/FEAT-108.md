---
id: FEAT-108
title: TS Phase 1.3 — migrate cost-hygiene leaves to .ts
priority: P1
status: triaged
category: code-quality
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md
plan: null
related: [FEAT-100, FEAT-106, FEAT-107, FEAT-109, FEAT-110, FEAT-111, FEAT-112, FEAT-113]
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
# FEAT-108 — TS Phase 1.3: cost-hygiene leaf modules

## Why

Migrate the 3 small cost-hygiene leaf modules that have no external callers
outside the aggregator. Clean types here feed the aggregator slice (FEAT-109).

## Spec

`docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md` § Phase 1, slice 1.3.

## Acceptance criteria

- [ ] AC-1: `scripts/lib/cost-hygiene/state.mjs` renamed to `.ts`; imports updated.
- [ ] AC-2: `scripts/lib/cost-hygiene/decide.mjs` renamed to `.ts`; imports updated.
- [ ] AC-3: `scripts/lib/cost-hygiene/render-frontmatter.mjs` renamed to `.ts`; imports updated.
- [ ] AC-4: Explicit TypeScript types; no `any`; `tsc --noEmit` clean.
- [ ] AC-5: Dead code removed.
- [ ] AC-6: `Result<T,E>` applied where domain errors are meaningful.
- [ ] AC-7: All CI gates pass.

## Notes

- Per-slice protocol from spec.
- Sets up clean interfaces for cost-hygiene aggregator slice (FEAT-109).
