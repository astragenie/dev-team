---
id: FEAT-115
title: TS Phase 2.2 — migrate artifacts + linkage modules to .ts
priority: P1
status: done
category: code-quality
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md
plan: null
related: [FEAT-114]
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
slices: [SLICE-39]
slices_complete: [SLICE-39]
started_at: 2026-06-07
completed_at: 2026-06-07
github_issue: 95
github_milestone: null
github_url: "https://github.com/sergeymilashico/hero-crew/issues/95"
---
# FEAT-115 — TS Phase 2.2: artifacts + linkage modules

## Why

Migrate artifacts (688 lines — must split into read/write per ISP),
outcome-linkage (112 lines), and deployment-guidance (303 lines — must split).

## Spec

`docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md` § Phase 2, slice 2.2.

## Acceptance criteria

- [ ] AC-1: `scripts/lib/artifacts.mjs` renamed to `.ts`; split into `artifacts/read.ts` + `artifacts/write.ts` (688 lines, ISP required).
- [ ] AC-2: `scripts/lib/outcome-linkage.mjs` renamed to `.ts`; imports updated.
- [ ] AC-3: `scripts/lib/deployment-guidance.mjs` renamed to `.ts`; split if >300 lines.
- [ ] AC-4: Explicit TypeScript types; no `any`; `tsc --noEmit` clean.
- [ ] AC-5: `Result<T,E>` applied to artifact write operations.
- [ ] AC-6: `ArtifactReader` / `ArtifactWriter` interfaces per ISP.
- [ ] AC-7: Functions >30 lines split per SRP.
- [ ] AC-8: All CI gates pass.

## Notes

- Depends on FEAT-114 (core state typed — artifacts imports workflow-state).
- artifacts.mjs (688 lines) is the largest single module; split is mandatory.
- Per-slice protocol from spec.
