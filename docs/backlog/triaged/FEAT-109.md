---
id: FEAT-109
title: TS Phase 1.4 — migrate cost-hygiene aggregator + session-cost-scanner to .ts
priority: P1
status: triaged
category: code-quality
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md
plan: null
related: [FEAT-100, FEAT-106, FEAT-107, FEAT-108, FEAT-110, FEAT-111, FEAT-112, FEAT-113]
phase: null
tags: ["concern:code-quality", "surface:tooling", "stack:typescript", "stack:node"]
pm_customer_impact: 0.5
pm_demand_signal: null
pm_technical_feasibility: 0.85
pm_scope_risk: 0.3
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
# FEAT-109 — TS Phase 1.4: cost-hygiene aggregator + session-cost-scanner

## Why

Migrate the cost-hygiene aggregator files and session-cost-scanner, which
depend on the leaf modules from FEAT-108. Completes the cost-hygiene
subsystem migration.

## Spec

`docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md` § Phase 1, slice 1.4.

## Acceptance criteria

- [ ] AC-1: `scripts/lib/cost-hygiene/emit-cost-report.mjs` renamed to `.ts`; imports updated.
- [ ] AC-2: `scripts/lib/cost-hygiene/cost-slice-handler.mjs` renamed to `.ts`; imports updated.
- [ ] AC-3: `scripts/lib/session-cost-scanner.mjs` renamed to `.ts`; imports updated.
- [ ] AC-4: Explicit TypeScript types; no `any`; `tsc --noEmit` clean.
- [ ] AC-5: Dead code removed.
- [ ] AC-6: `Result<T,E>` applied where domain errors are meaningful.
- [ ] AC-7: All CI gates pass.

## Notes

- Depends on FEAT-108 (cost-hygiene leaves typed).
- Per-slice protocol from spec.
