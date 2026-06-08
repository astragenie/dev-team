---
id: FEAT-128
title: "Perf: parallelize validate-* scripts into concurrent validate-all runner"
priority: P2
status: triaged
category: performance
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: "docs/superpowers/specs/2026-06-08-plugin-perf-quality-10-design.md"
plan: null
related: []
phase: null
tags: ["stack:node", "concern:performance", "surface:scripts", "surface:ci"]
pm_customer_impact: null
pm_demand_signal: null
pm_technical_feasibility: null
pm_scope_risk: null
pm_strategic_alignment: null
pm_composite: null
updated: 2026-06-08
created: 2026-06-08
triaged_at: 2026-06-08
triage_notes: "regex-fallback P2; autonomous_safe=true: pure script change, AC count >= 4"
slices: []
depends_on: []
github_issue: null
github_milestone: null
github_url: null
---
## Description

Four validate-* scripts (`validate-manifests.ts`, `validate-skills.ts`, `validate-agents.ts`, `validate-slices.ts`) run sequentially. A concurrent runner improves local feedback speed.

## Acceptance Criteria

- New `scripts/validate-all.ts`: `Promise.all([...4 validators...])`, collect all failures, exit non-zero if any fail
- Add `"validate:all": "node --experimental-strip-types scripts/validate-all.ts"` to `package.json`
- `npm run validate:all` exits 0 on clean repo
- `npm run validate:all` exits 1 and prints all failures when any validator fails
- Individual validate-* scripts unchanged
