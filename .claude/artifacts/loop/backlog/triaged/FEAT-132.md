---
id: FEAT-132
title: "Quality: derive Flags interface from FLAG_SPEC in crew.ts (single source of truth)"
priority: P2
status: triaged
category: quality
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-08-plugin-perf-quality-10-design.md
plan: null
related: []
phase: null
tags: ["stack:node", "stack:typescript", "concern:quality", "surface:scripts"]
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
slices: []
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
---
## Description

`scripts/crew.ts` has both `FLAG_SPEC` (runtime array, ~90 flags) and a hand-written `Flags` TypeScript interface enumerating the same flags. Adding or removing a flag requires updating both — drift-prone.

## Acceptance Criteria

- Derive `Flags` type from `FLAG_SPEC` using a mapped type (exact derivation depends on FLAG_SPEC runtime structure — builder inspects and determines correct pattern)
- Remove the hand-written `Flags` interface
- `npm run typecheck` passes — TypeScript compiler enforces sync
- No runtime behavior change
- Test: assert `FLAG_SPEC.length` equals known baseline count (prevents silent removal)
