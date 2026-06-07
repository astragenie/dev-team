---
id: FEAT-110
title: TS Phase 1.5 — migrate briefing leaf modules to .ts
priority: P1
status: done
category: code-quality
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md
plan: null
related: [FEAT-100, FEAT-106, FEAT-107, FEAT-108, FEAT-109, FEAT-111, FEAT-112, FEAT-113]
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
triage_notes: "autonomous_safe inferred: AC count=6, derived_from=null → true"
updated: 2026-06-07
slices: [SLICE-34]
slices_complete: [SLICE-34]
started_at: 2026-06-07
completed_at: 2026-06-07
---
# FEAT-110 — TS Phase 1.5: briefing leaf modules

## Why

Migrate the 2 briefing leaf modules (cost parser and renderer) that have
no external callers outside the collector. Clean types feed the briefing
collector migration (FEAT-111).

## Spec

`docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md` § Phase 1, slice 1.5.

## Acceptance criteria

- [ ] AC-1: `scripts/lib/briefing/collect-cost-parser.mjs` renamed to `.ts`; imports updated.
- [ ] AC-2: `scripts/lib/briefing/render.mjs` renamed to `.ts`; imports updated.
- [ ] AC-3: Explicit TypeScript types; no `any`; `tsc --noEmit` clean.
- [ ] AC-4: Dead code removed.
- [ ] AC-5: `Result<T,E>` applied where domain errors are meaningful.
- [ ] AC-6: All CI gates pass.

## Notes

- Per-slice protocol from spec.
- Sets up clean interfaces for briefing collector slice (FEAT-111).
