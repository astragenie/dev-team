---
id: FEAT-103
title: "Perf win 4 — memoize hot frontmatter reads keyed by (path, mtime)"
priority: P3
status: done
category: perf
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md
plan: null
related: [FEAT-100, FEAT-101, FEAT-102, FEAT-104, FEAT-105]
phase: null
tags: ["concern:performance", "surface:cli", "stack:node"]
pm_customer_impact: 0.5
pm_demand_signal: null
pm_technical_feasibility: null
pm_scope_risk: null
pm_strategic_alignment: 0.5
pm_composite: null
pm_legacy_demand_signal: null
pm_legacy_customer_impact: null
pm_effort_estimate: 0.5
pm_technical_risk: 0.5
pm_dependency_depth: 0.5
migration_note: legacy PM schema preserved as pm_legacy_*; new dimensions defaulted to 0.5 on 2026-06-07
triage_notes: "autonomous_safe inferred: AC count=7, derived_from=null → true"
updated: 2026-06-07
started_at: 2026-06-07
slices: [SLICE-21]
slices_complete: [SLICE-21]
completed_at: 2026-06-07
github_issue: 70
github_milestone: null
github_url: "https://github.com/sergeymilashico/hero-crew/issues/70"
---
# FEAT-103 — Perf win 4: memoize hot frontmatter reads

## Why

The same artifact file is parsed in `briefing/collect.mjs`, `briefing/render.mjs`, and `session-cost-scanner.mjs` during a single `brief-me` invocation. Each re-parses the YAML/JSON frontmatter from disk. A module-level cache keyed by `(absolutePath, mtime.getTime())` returns the parsed object after the first read, invalidates when the file changes on disk. Estimated saving: 50–150 ms per `brief-me`.

`autonomous_safe: true` — small new helper module, no semantic change.

## Spec

`docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md` § Top-10 perf wins #4.

## Plan

To be authored during slice promotion.

## Acceptance criteria

- [ ] AC-1: New module `scripts/lib/artifact-cache.mjs` (or `.ts` if landing post-Phase-0) exposes `getCachedFrontmatter(absPath)` returning parsed frontmatter (and body, optionally).
- [ ] AC-2: Cache key includes `mtimeMs` from `fs.stat`. A changed-on-disk file is re-read, not stale.
- [ ] AC-3: At least 2 call sites refactored to use the cached reader: one in `briefing/`, one in `session-cost-scanner.mjs`.
- [ ] AC-4: Unit tests: (a) second call returns cached result (assert via spy that read is called once), (b) stale-after-mtime-change test, (c) ENOENT propagates.
- [ ] AC-5: `brief-me` output byte-identical to pre-change baseline.
- [ ] AC-6: PR body includes baseline vs post-change p50/p95 timings on a slice with re-reads.
- [ ] AC-7: All existing CI gates green.

## Notes

- Win/Effort = S / Risk = L.
- Cache lifetime is per-process (CLI invocation). No cross-process or on-disk caching.
