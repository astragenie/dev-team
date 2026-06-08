---
id: FEAT-131
title: "Quality: consolidate pathExists(×5) + readJson(×2) into scripts/lib/fs-utils.ts"
priority: P2
status: in-progress
category: quality
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-08-plugin-perf-quality-10-design.md
plan: null
related: [FEAT-127]
phase: null
tags: ["stack:node", "concern:quality", "surface:scripts"]
pm_customer_impact: 0.5
pm_demand_signal: null
pm_technical_feasibility: null
pm_scope_risk: null
pm_strategic_alignment: 0.5
pm_composite: null
updated: 2026-06-08
created: 2026-06-08
triaged_at: null
triage_notes: "priority inferred as P2 from body content; autonomous_safe inferred: AC count=5, derived_from=null → true"
slices: [SLICE-59]
depends_on: []
github_issue: null
github_milestone: null
github_url: null
pm_legacy_demand_signal: null
pm_legacy_customer_impact: null
pm_effort_estimate: 0.5
pm_technical_risk: 0.5
pm_dependency_depth: 0.5
migration_note: legacy PM schema preserved as pm_legacy_*; new dimensions defaulted to 0.5 on 2026-06-08
started_at: 2026-06-08
---
## Description

`pathExists()` is defined in 5 separate files; `readJson()` is defined in 2 files. Both are identical utility functions.

Callers:
- `pathExists`: `briefing/collect.ts`, `deployment-guidance/read.ts`, `fleet.ts`, `installer/util.ts`, `wakeup.mjs`
- `readJson`: `wakeup.mjs`, `validate-manifests.ts`

## Acceptance Criteria

- New `scripts/lib/fs-utils.ts`: exports `pathExists(p: string): Promise<boolean>` and `readJson<T>(p: string): Promise<T>`
- All 7 call sites import from `scripts/lib/fs-utils.ts`; local definitions deleted
- `installer/util.ts` re-exports from `fs-utils` if any consumers import it directly
- Unit tests: `pathExists` for existing/missing path; `readJson` for valid JSON, missing file, malformed JSON
- `npm run typecheck` + `npm run lint` clean
