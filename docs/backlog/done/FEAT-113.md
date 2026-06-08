---
id: FEAT-113
title: TS Phase 1.8 — migrate installer core modules to .ts
priority: P1
status: done
category: code-quality
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md
plan: null
related: [FEAT-100, FEAT-106, FEAT-107, FEAT-108, FEAT-109, FEAT-110, FEAT-111, FEAT-112]
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
triage_notes: "autonomous_safe inferred: AC count=13, derived_from=null → true"
updated: 2026-06-07
slices: [SLICE-37]
slices_complete: [SLICE-37]
started_at: 2026-06-07
completed_at: 2026-06-07
github_issue: 91
github_milestone: null
github_url: "https://github.com/sergeymilashico/hero-crew/issues/91"
---
# FEAT-113 — TS Phase 1.8: installer core modules

## Why

Migrate the installer core — 7 modules + the installer facade. These depend
on FEAT-112 leaf modules. Completes the entire installer subsystem migration
and closes Phase 1.

## Spec

`docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md` § Phase 1, slice 1.8.

## Acceptance criteria

- [ ] AC-1: `scripts/lib/installer/audit.mjs` renamed to `.ts`; imports updated.
- [ ] AC-2: `scripts/lib/installer/claude-md.mjs` renamed to `.ts`; imports updated.
- [ ] AC-3: `scripts/lib/installer/harness-files.mjs` renamed to `.ts`; imports updated.
- [ ] AC-4: `scripts/lib/installer/legacy-migration.mjs` renamed to `.ts`; imports updated.
- [ ] AC-5: `scripts/lib/installer/repo-guides.mjs` renamed to `.ts`; imports updated.
- [ ] AC-6: `scripts/lib/installer/settings.mjs` renamed to `.ts`; imports updated.
- [ ] AC-7: `scripts/lib/installer/global.mjs` renamed to `.ts`; imports updated.
- [ ] AC-8: `scripts/lib/installer.mjs` renamed to `.ts`; imports updated.
- [ ] AC-9: Explicit TypeScript types; no `any`; `tsc --noEmit` clean.
- [ ] AC-10: Dead code removed.
- [ ] AC-11: `Result<T,E>` applied where domain errors are meaningful.
- [ ] AC-12: Functions >30 lines or files >300 lines split per SRP.
- [ ] AC-13: All CI gates pass.

## Notes

- Depends on FEAT-112 (installer leaves typed).
- Installer modules are the largest batch in Phase 1 — expect some SRP splits.
- Per-slice protocol from spec.
