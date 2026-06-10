---
id: FEAT-106
title: TS Phase 1.1 — migrate scope-estimate + ux-validation leaves to .ts
priority: P1
status: done
category: code-quality
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md
plan: null
related: [FEAT-100, FEAT-107, FEAT-108, FEAT-109, FEAT-110, FEAT-111, FEAT-112, FEAT-113]
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
slices: [SLICE-29]
slices_complete: [SLICE-29]
started_at: 2026-06-07
completed_at: 2026-06-07
github_issue: 77
github_milestone: null
github_url: "https://github.com/sergeymilashico/hero-crew/issues/77"
created: 2026-06-10
depends_on: []
---
# FEAT-106 — TS Phase 1.1: scope-estimate + ux-validation leaves

## Why

Kick off leaf-up TS migration. These 3 files are pure leaf modules (no
callers outside their own test) — lowest risk entry point for Phase 1.

## Spec

`docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md` § Phase 1, slice 1.1.

## Acceptance criteria

- [ ] AC-1: `scripts/lib/scope-estimate.mjs` renamed to `.ts`; all imports updated.
- [ ] AC-2: `scripts/lib/ux-validation/classify-scenario.mjs` renamed to `.ts`; imports updated.
- [ ] AC-3: `scripts/lib/ux-validation/discover-playwright.mjs` renamed to `.ts`; imports updated.
- [ ] AC-4: Each migrated file has explicit TypeScript types (no `any`); `tsc --noEmit` clean.
- [ ] AC-5: Dead code surfaced by `noUnusedLocals`/`noUnusedParameters` removed.
- [ ] AC-6: `Result<T,E>` applied where errors are domain-meaningful.
- [ ] AC-7: All CI gates pass: lint, format:check, typecheck, `npm test`, e2e:smoke.

## Notes

- Per-slice protocol from spec: rename → type → Result → dead code → gates.
- Existing `.mjs` test files remain `.mjs` until Phase 4.
- No tsconfig changes needed — Phase 0 already widened `include`.
