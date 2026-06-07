---
id: FEAT-111
title: TS Phase 1.6 — migrate briefing collector + briefing.mjs to .ts
priority: P1
status: done
category: code-quality
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md
plan: null
related: [FEAT-100, FEAT-106, FEAT-107, FEAT-108, FEAT-109, FEAT-110, FEAT-112, FEAT-113]
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
slices: [SLICE-35]
slices_complete: [SLICE-35]
started_at: 2026-06-07
completed_at: 2026-06-07
---
# FEAT-111 — TS Phase 1.6: briefing collector + briefing.mjs

## Why

Migrate the briefing collector (largest file in briefing subsystem) and
the briefing facade. Completes the entire briefing subsystem migration.

## Spec

`docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md` § Phase 1, slice 1.6.

## Acceptance criteria

- [ ] AC-1: `scripts/lib/briefing/collect.mjs` renamed to `.ts`; imports updated.
- [ ] AC-2: `scripts/lib/briefing.mjs` renamed to `.ts`; imports updated.
- [ ] AC-3: Explicit TypeScript types; no `any`; `tsc --noEmit` clean.
- [ ] AC-4: Dead code removed (noUnusedLocals/noUnusedParameters).
- [ ] AC-5: `Result<T,E>` applied where domain errors are meaningful.
- [ ] AC-6: Functions >30 lines split per SRP.
- [ ] AC-7: All CI gates pass.

## Notes

- Depends on FEAT-110 (briefing leaves typed).
- collect.mjs is the largest file in briefing — may need function splits.
- Per-slice protocol from spec.
