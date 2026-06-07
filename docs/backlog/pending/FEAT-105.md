---
id: FEAT-105
title: "Perf win 10 — replace stat-before-read with try/catch ENOENT"
priority: P3
status: pending
category: perf
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md
plan: null
related: [FEAT-100, FEAT-101, FEAT-102, FEAT-103, FEAT-104]
phase: null
tags: [concern:performance, surface:cli, stack:node]
pm_customer_impact: null
pm_demand_signal: null
pm_technical_feasibility: null
pm_scope_risk: null
pm_strategic_alignment: null
pm_composite: null
---
# FEAT-105 — Perf win 10: skip stat-before-read

## Why

The codebase has many call sites following the pattern:

```js
if (existsSync(path)) {
  return readFileSync(path, 'utf8');
}
```

That's two syscalls per attempted read. Replacing with `try { return readFileSync(path, 'utf8'); } catch (e) { if (e.code !== 'ENOENT') throw e; return null; }` is one syscall in the present-file case and one in the missing-file case. Estimated saving: 30–80 ms compound across a `brief-me`.

`autonomous_safe: true` — mechanical refactor with strict ENOENT-only swallow.

## Spec

`docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md` § Top-10 perf wins #10.

## Plan

To be authored during slice promotion.

## Acceptance criteria

- [ ] AC-1: A grep for `existsSync\(.*\)\s*\)\s*\{?\s*return\s+readFile|existsSync.*readFileSync` finds at most 5 remaining occurrences in `scripts/` (count is `≥30` today; document baseline in PR).
- [ ] AC-2: A shared helper (e.g. `readFileIfExists(path)` returning `string | null`) is introduced and used at the refactored sites.
- [ ] AC-3: Any error other than `ENOENT` still propagates — the catch must be code-gated, not blanket.
- [ ] AC-4: Unit test: present file returns content; missing file returns null; permission-denied throws.
- [ ] AC-5: All existing tests pass unchanged.
- [ ] AC-6: PR body includes baseline vs post-change p50/p95 timings.
- [ ] AC-7: All existing CI gates green.

## Notes

- Win/Effort = S / Risk = L.
