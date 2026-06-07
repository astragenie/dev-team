---
id: FEAT-101
title: Perf win 1 — tail-read events.jsonl instead of full file scan
priority: P2
status: done
category: perf
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md
plan: null
related: [FEAT-100, FEAT-102, FEAT-103, FEAT-104, FEAT-105]
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
triage_notes: "autonomous_safe inferred: AC count=6, derived_from=null → true"
updated: 2026-06-07
started_at: 2026-06-07
slices: [SLICE-19]
slices_complete: [SLICE-19]
completed_at: 2026-06-07
---
# FEAT-101 — Perf win 1: tail-read events.jsonl

## Why

`brief-me` and the cost scanner read all of `.claude/logs/events.jsonl` (~860 KB, 3.4k lines on this repo today) to surface the last few `session_start` events. Reverse-reading the last ~64 KB is enough to find the latest few events in practice. Estimated saving: 200–400 ms cold / 50–100 ms warm per `brief-me`.

Mechanical change, no module surgery — ships before Phase 1 leaf migration. Behaviour-preserving when the tail window contains the events of interest (the loop only cares about recent events; older events are surfaced via paged archive scans, not this hot path).

`autonomous_safe: true` — pure perf change in one helper, covered by existing tests + new perf assertion.

## Spec

`docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md` § Top-10 perf wins #1.

## Plan

To be authored during slice promotion (`/loop:slice-plan`).

## Acceptance criteria

- [ ] AC-1: A `tailReadJsonl(filePath, options)` helper exists (under `scripts/lib/`) that reads the last N bytes (configurable, default 64 KB), discards the truncated first line, and yields parsed objects.
- [ ] AC-2: Callers in `scripts/lib/briefing/collect.mjs` and `scripts/lib/session-cost-scanner.mjs` that previously full-read events.jsonl to extract recent `session_start` events now use the new helper.
- [ ] AC-3: ≥3 unit tests cover: (a) happy path with multi-line tail, (b) tail boundary discards partial leading line, (c) file smaller than tail-window reads in full.
- [ ] AC-4: `brief-me` output is byte-identical to pre-change baseline for a fixture repo (regression test).
- [ ] AC-5: PR body includes `time` measurement comparison: 5 baseline runs vs 5 post-change runs, p50 + p95 deltas reported.
- [ ] AC-6: All existing CI gates green.

## Notes

- Win/Effort = S / Risk = L.
- Order: ships before Phase 1 leaf migration. Sequencing per spec sequencing table.
