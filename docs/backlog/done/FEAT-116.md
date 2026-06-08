---
id: FEAT-116
title: TS Phase 2.3 — migrate cost-advisor stack to .ts
priority: P1
status: done
category: code-quality
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md
plan: null
related: [FEAT-114, FEAT-115]
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
triage_notes: "autonomous_safe inferred: AC count=8, derived_from=null → true"
updated: 2026-06-07
slices: [SLICE-40]
slices_complete: [SLICE-40]
started_at: 2026-06-07
completed_at: 2026-06-07
github_issue: 97
github_milestone: null
github_url: "https://github.com/sergeymilashico/hero-crew/issues/97"
---
# FEAT-116 — TS Phase 2.3: cost-advisor stack

## Why

Migrate cost-advisor (485 lines), cost-advisor-grades (105 lines),
cost-advisor-rules (297 lines), and session-cost (453 lines).
Strategy pattern for rule dispatch; function pointers not class wrappers.

## Spec

`docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md` § Phase 2, slice 2.3.

## Acceptance criteria

- [ ] AC-1: `scripts/lib/cost-advisor.mjs` renamed to `.ts`; imports updated.
- [ ] AC-2: `scripts/lib/cost-advisor-grades.mjs` renamed to `.ts`; imports updated.
- [ ] AC-3: `scripts/lib/cost-advisor-rules.mjs` renamed to `.ts`; imports updated.
- [ ] AC-4: `scripts/lib/session-cost.mjs` renamed to `.ts`; imports updated.
- [ ] AC-5: Explicit TypeScript types; no `any`; `tsc --noEmit` clean.
- [ ] AC-6: Strategy as function pointer for rule dispatch (no class wrappers for switch-on-string).
- [ ] AC-7: Functions >30 lines split per SRP.
- [ ] AC-8: All CI gates pass.

## Notes

- Depends on FEAT-115 (artifacts typed — cost-advisor writes artifacts).
- cost-advisor (485 lines) and session-cost (453 lines) may need file splits.
- Per-slice protocol from spec.
