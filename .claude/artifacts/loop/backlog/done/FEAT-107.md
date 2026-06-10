---
id: FEAT-107
title: TS Phase 1.2 — migrate preflight + subagent-return leaves to .ts
priority: P1
status: done
category: code-quality
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md
plan: null
related: [FEAT-100, FEAT-106, FEAT-108, FEAT-109, FEAT-110, FEAT-111, FEAT-112, FEAT-113]
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
slices: [SLICE-30]
slices_complete: [SLICE-30]
started_at: 2026-06-07
completed_at: 2026-06-07
github_issue: 79
github_milestone: null
github_url: "https://github.com/sergeymilashico/hero-crew/issues/79"
created: 2026-06-10
depends_on: []
---
# FEAT-107 — TS Phase 1.2: preflight + subagent-return leaves

## Why

Continue leaf-up TS migration with 2 leaf modules: preflight checks and
subagent-return check. Both are small, self-contained, easy to type.

## Spec

`docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md` § Phase 1, slice 1.2.

## Acceptance criteria

- [ ] AC-1: `scripts/lib/preflight/checks.mjs` renamed to `.ts`; imports updated.
- [ ] AC-2: `scripts/lib/subagent-return/check.mjs` renamed to `.ts`; imports updated.
- [ ] AC-3: Explicit TypeScript types; no `any`; `tsc --noEmit` clean.
- [ ] AC-4: Dead code removed; `noUnusedLocals`/`noUnusedParameters` violations fixed.
- [ ] AC-5: `Result<T,E>` applied where domain errors are meaningful.
- [ ] AC-6: All CI gates pass.

## Notes

- Depends on FEAT-106 being done (establish Phase 1 rhythm).
- Per-slice protocol from spec.
