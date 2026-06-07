---
id: FEAT-104
title: "Perf win 9 — cache payloads readdir per process with mtime invalidation"
priority: P3
status: pending
category: perf
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md
plan: null
related: [FEAT-100, FEAT-101, FEAT-102, FEAT-103, FEAT-105]
phase: null
tags: [concern:performance, surface:cli, stack:node]
pm_customer_impact: null
pm_demand_signal: null
pm_technical_feasibility: null
pm_scope_risk: null
pm_strategic_alignment: null
pm_composite: null
---
# FEAT-104 — Perf win 9: cache payloads readdir

## Why

`.claude/logs/payloads/` holds ~2.8k files on this repo. The session-cost scanner runs `readdir` on it (sometimes multiple times per `brief-me` invocation when scanning multiple slices). Cache the sorted file list at module level, invalidate when the directory's mtime changes. Estimated saving: 80–150 ms per cost-aggregate `brief-me`.

`autonomous_safe: true` — single helper, mtime-based invalidation, no behaviour change.

## Spec

`docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md` § Top-10 perf wins #9.

## Plan

To be authored during slice promotion.

## Acceptance criteria

- [ ] AC-1: A helper (e.g. `getPayloadsIndex(dir)`) caches the sorted-descending file list per process; subsequent calls within the same process return the cached array unless `fs.stat(dir).mtimeMs` has advanced.
- [ ] AC-2: Cost scanner uses the helper instead of raw `fs.readdir`.
- [ ] AC-3: Unit tests: (a) second call without mtime change returns same array reference (cached), (b) mtime advance invalidates cache.
- [ ] AC-4: PR body includes baseline vs post-change p50/p95 on a cost-aggregate `brief-me`.
- [ ] AC-5: All existing CI gates green.

## Notes

- Win/Effort = S / Risk = M (directory mtime semantics differ between filesystems; verify on the target dev machine).
