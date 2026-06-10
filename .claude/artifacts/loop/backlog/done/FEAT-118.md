---
id: FEAT-118
title: TS Phase 3.1 — entrypoint cutover (crew.mjs + siblings → .ts)
priority: P1
status: done
category: code-quality
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md
plan: null
related: [FEAT-114, FEAT-115, FEAT-116, FEAT-117]
phase: null
tags: ["concern:code-quality", "surface:tooling", "stack:typescript", "stack:node"]
pm_customer_impact: 0.5
pm_demand_signal: null
pm_technical_feasibility: 0.75
pm_scope_risk: 0.5
pm_strategic_alignment: 0.5
pm_composite: null
pm_legacy_demand_signal: null
pm_legacy_customer_impact: 0.5
pm_effort_estimate: 0.5
pm_technical_risk: 0.5
pm_dependency_depth: 0.5
updated: 2026-06-07
slices: [SLICE-42]
slices_complete: [SLICE-42]
migration_note: legacy PM schema preserved as pm_legacy_*; new dimensions defaulted to 0.5 on 2026-06-07
triage_notes: "autonomous_safe inferred: AC count=8, derived_from=null → true"
started_at: 2026-06-07
completed_at: 2026-06-07
github_issue: 101
github_milestone: null
github_url: "https://github.com/sergeymilashico/hero-crew/issues/101"
created: 2026-06-10
depends_on: []
---
# FEAT-118 — TS Phase 3.1: entrypoint cutover

## Why

Migrate the main entrypoints (`scripts/crew.mjs` + 9 sibling entrypoints) to `.ts`. Update all skill `.md` references, marketplace.json, and agent prompts that reference scripts. This completes the runtime-visible portion of the TS migration.

## Spec

`docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md` § Phase 3, slice 3.1.

## Acceptance criteria

- [ ] AC-1: `scripts/crew.mjs` renamed to `crew.ts`; all other entrypoints renamed to `.ts`.
- [ ] AC-2: All skill `.md` files with script references updated to `.ts` paths.
- [ ] AC-3: `marketplace.json` entrypoint references updated.
- [ ] AC-4: Agent prompts referencing scripts updated.
- [ ] AC-5: No `any`; `tsc --noEmit` clean.
- [ ] AC-6: Functions >30 body lines split.
- [ ] AC-7: All CI gates pass (npm test 437+, lint clean, typecheck exit 0).
- [ ] AC-8: e2e smoke passes (`npm run e2e:smoke`).

## Notes

- High-risk slice: entrypoint names change affects plugin install and all skill invocations.
- Coordinate: staging install on sample repo before commit.
- Rollback plan: revert commit if plugin install breaks on fresh clone.
- Per spec: run in worktree, validate install, then merge.
