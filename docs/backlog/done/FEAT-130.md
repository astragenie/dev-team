---
id: FEAT-130
title: "Perf: crew prune-artifacts command to prevent accumulation slowdown"
priority: P2
status: done
category: performance
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-08-plugin-perf-quality-10-design.md
plan: null
related: []
phase: null
tags: ["stack:node", "concern:performance", "surface:scripts", "surface:commands"]
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
completed_at: 2026-06-08
---
## Description

`.claude/artifacts/crew/` accumulates indefinitely; file scanning (brief-me, wake-up) slows down over time as artifact count grows.

## Acceptance Criteria

- New `scripts/prune-artifacts.ts`: scan `.claude/artifacts/crew/` subdirs, delete files where `mtime < Date.now() - days * 86400000`
- Flags: `--older-than <days>` (default: 90), `--dry-run` (print list, no delete), `--repo <path>`
- New `commands/prune-artifacts.md`: registers `crew prune-artifacts` command
- `--dry-run` lists files without deleting
- Destructive mode deletes only files matching age threshold
- Rejects invalid `--older-than` (NaN, negative, zero)
- Unit tests for age filter logic (pure function, no I/O)
- `node ./scripts/validate-manifests.ts` passes after adding command
