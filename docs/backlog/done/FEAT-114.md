---
id: FEAT-114
title: TS Phase 2.1 — migrate core state modules to .ts
priority: P1
status: done
category: code-quality
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md
plan: null
related: [FEAT-106, FEAT-107, FEAT-108, FEAT-109, FEAT-110, FEAT-111, FEAT-112, FEAT-113]
phase: null
tags: ["concern:code-quality", "surface:tooling", "stack:typescript", "stack:node"]
pm_customer_impact: 0.5
pm_demand_signal: null
pm_technical_feasibility: 0.8
pm_scope_risk: 0.4
pm_strategic_alignment: 0.5
pm_composite: null
pm_legacy_demand_signal: null
pm_legacy_customer_impact: 0.5
pm_effort_estimate: 0.5
pm_technical_risk: 0.5
pm_dependency_depth: 0.5
migration_note: legacy PM schema preserved as pm_legacy_*; new dimensions defaulted to 0.5 on 2026-06-07
triage_notes: "autonomous_safe inferred: AC count=9, derived_from=null → true"
updated: 2026-06-07
slices: [SLICE-38]
slices_complete: [SLICE-38]
started_at: 2026-06-07
completed_at: 2026-06-07
---
# FEAT-114 — TS Phase 2.1: core state modules

## Why

Migrate the three core state management modules. These are the most-imported
modules in the codebase — workflow-state (450 lines), claims (333 lines),
approvals (230 lines). workflow-state exceeds the 300-line file budget and
must be split into read/mutate modules per the spec ISP requirement.

## Spec

`docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md` § Phase 2, slice 2.1.

## Acceptance criteria

- [ ] AC-1: `scripts/lib/workflow-state.mjs` renamed to `.ts`; split into read/mutate per ISP (>300 lines).
- [ ] AC-2: `scripts/lib/claims.mjs` renamed to `.ts`; imports updated.
- [ ] AC-3: `scripts/lib/approvals.mjs` renamed to `.ts`; imports updated.
- [ ] AC-4: Explicit TypeScript types; no `any`; `tsc --noEmit` clean.
- [ ] AC-5: Dead code removed.
- [ ] AC-6: `Result<T,E>` applied to claim, approval resolve, badge set operations.
- [ ] AC-7: Discriminated unions for workflow gate state (`{ status: 'pending' | 'passed' | 'failed' | 'skipped'; ... }`).
- [ ] AC-8: Functions >30 lines split per SRP.
- [ ] AC-9: All CI gates pass.

## Notes

- workflow-state.mjs (450 lines) must split: `workflow-state/read.ts` + `workflow-state/write.ts`.
- Per-slice protocol from spec.
- Callers: scripts/crew.mjs + many lib modules — grep before starting.
