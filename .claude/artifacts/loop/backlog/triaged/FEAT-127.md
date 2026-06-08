---
id: FEAT-127
title: "Perf: fix serial fs.stat() → readdir+withFileTypes in wakeup.mjs"
priority: P2
status: triaged
category: performance
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-08-plugin-perf-quality-10-design.md
plan: null
related: [FEAT-131]
phase: null
tags: ["stack:node", "concern:performance", "surface:scripts"]
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

`countFiles()` (lines 57–71) and `listFilesNewestFirst()` (lines 78–93) in `scripts/lib/wakeup.mjs` call `await fs.stat()` inside serial loops — N syscalls per directory.

## Acceptance Criteria

- `countFiles(dir)`: replace `for await` + `stat()` with `readdir(dir, {withFileTypes:true})`; count entries where `entry.isFile()`
- `listFilesNewestFirst(dir)`: replace with `readdir+withFileTypes`, then `Promise.all(entries.map(...))` for mtime sort — one batch, not serial
- Existing tests for `countFiles` pass
- New test: N-file directory returns correct count
- `npm run lint` zero warnings
