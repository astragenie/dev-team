---
id: FEAT-102
title: Perf win 2 — parallelize artifact reads in briefing/collect
priority: P2
status: done
category: perf
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md
plan: null
related: [FEAT-100, FEAT-101, FEAT-103, FEAT-104, FEAT-105]
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
triage_notes: "autonomous_safe inferred: AC count=5, derived_from=null → true"
updated: 2026-06-07
started_at: 2026-06-07
slices: [SLICE-20]
slices_complete: [SLICE-20]
completed_at: 2026-06-07
github_issue: 68
github_milestone: null
github_url: "https://github.com/sergeymilashico/hero-crew/issues/68"
created: 2026-06-10
depends_on: []
---
# FEAT-102 — Perf win 2: parallelize artifact reads

## Why

`scripts/lib/briefing/collect.mjs` reads `runBrief`, every `handoffs[]` entry, `reviewResult`, `validationPlan`, `validationResult`, `deploymentChecks.{dev,prod}`, and `finalSynthesis` sequentially via awaited `fs.readFile`. On a slice with ~3 handoffs that's ~7 sequential reads = latency dominated by serialised I/O. Wrap in `Promise.all`; latency drops from sum to max. Estimated saving: 100–300 ms per `brief-me`.

Mechanical change, no module surgery. Ships pre-Phase-1.

`autonomous_safe: true` — pure perf change.

## Spec

`docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md` § Top-10 perf wins #2.

## Plan

To be authored during slice promotion.

## Acceptance criteria

- [ ] AC-1: `scripts/lib/briefing/collect.mjs` reads the 7+ workflow-run artifacts via `Promise.all` (or `Promise.allSettled` if missing files are routine), not sequential await.
- [ ] AC-2: Missing-file behaviour preserved — current code tolerates ENOENT on optional artifacts; parallel version maps the same per-file fallback.
- [ ] AC-3: Existing briefing tests pass unchanged.
- [ ] AC-4: PR body includes baseline vs post-change `time` p50/p95 comparison on a slice with ≥3 handoffs.
- [ ] AC-5: All existing CI gates green.

## Notes

- Win/Effort = S / Risk = L.
