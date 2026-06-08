---
id: FEAT-045
title: Observability & artifact trail — hook health in brief-me + synthesis fixes + skill API check
priority: P1
status: done
category: observability
target_release: null
autonomous_safe: false
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-05-plugin-performance-stability-design.md
plan: docs/superpowers/plans/2026-06-05-feat-b-observability-artifact-trail.md
related: [FEAT-043, FEAT-044, FEAT-046]
phase: null
tags: ["concern:observability", "surface:cli", "concern:governance"]
pm_customer_impact: 0.8
pm_demand_signal: 0.85
pm_technical_feasibility: 0.85
pm_scope_risk: 0.75
pm_strategic_alignment: 0.85
pm_composite: 0.82
github_issue: 61
github_milestone: null
github_url: "https://github.com/sergeymilashico/hero-crew/issues/61"
---
# FEAT-045 — Observability & artifact trail

## Why

Hook scripts write to `events.jsonl` best-effort with no brief-me surface. Silent
errors produce no signal. Four SLICE synthesis artifacts contain `Grade missing`
placeholders corrupting loop context. `validate-skills.mjs` has no check for skill
docs referencing library functions that no longer exist.

`autonomous_safe: false` — brief-me output change touches user-facing surface.

## Spec

`docs/superpowers/specs/2026-06-05-plugin-performance-stability-design.md` → FEAT-B

## Acceptance criteria

- [x] AC-1: `crew.mjs wake-up` output includes `hookHealth` field listing per-hook error counts
- [x] AC-2: `brief-me` text output includes `## Hook health` section (green when all 0)
- [x] AC-3: All 4 hook scripts have top-level try/catch emitting `hook_error` events to events.jsonl
- [x] AC-4: SLICE-10/11/12/13 synthesis artifacts have no `Grade missing` or `<timestamp>` placeholders
- [x] AC-5: `validate-skills.mjs` warns when `## Implementation` names a function not found in the referenced file
- [x] AC-6: `npm run lint` zero warnings; `node --test` passes
