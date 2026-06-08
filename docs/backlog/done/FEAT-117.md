---
id: FEAT-117
title: TS Phase 2.4 — migrate fleet module to .ts
priority: P1
status: done
category: code-quality
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md
plan: null
related: [FEAT-114, FEAT-115, FEAT-116]
phase: null
tags: ["concern:code-quality", "surface:tooling", "stack:typescript", "stack:node"]
pm_customer_impact: 0.5
pm_demand_signal: null
pm_technical_feasibility: 0.85
pm_scope_risk: 0.2
pm_strategic_alignment: 0.5
pm_composite: null
pm_legacy_demand_signal: null
pm_legacy_customer_impact: 0.5
pm_effort_estimate: 0.5
pm_technical_risk: 0.5
pm_dependency_depth: 0.5
migration_note: legacy PM schema preserved as pm_legacy_*; new dimensions defaulted to 0.5 on 2026-06-07
triage_notes: "autonomous_safe inferred: AC count=4, derived_from=null → true"
updated: 2026-06-07
slices: [SLICE-41]
slices_complete: [SLICE-41]
started_at: 2026-06-07
completed_at: 2026-06-07
github_issue: 99
github_milestone: null
github_url: "https://github.com/sergeymilashico/hero-crew/issues/99"
---
# FEAT-117 — TS Phase 2.4: fleet module

## Why

Migrate fleet.mjs (212 lines) — the worktree visibility module. Closes Phase 2.

## Spec

`docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md` § Phase 2, slice 2.4.

## Acceptance criteria

- [ ] AC-1: `scripts/lib/fleet.mjs` renamed to `.ts`; imports updated.
- [ ] AC-2: Explicit TypeScript types; no `any`; `tsc --noEmit` clean.
- [ ] AC-3: Functions >30 lines split per SRP.
- [ ] AC-4: All CI gates pass.

## Notes

- Depends on FEAT-114 (workflow-state typed).
- Lightest Phase 2 slice — fleet.mjs is 212 lines, likely no splits needed.
- Per-slice protocol from spec.
