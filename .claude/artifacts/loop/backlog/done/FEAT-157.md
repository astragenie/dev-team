---
id: FEAT-157
status: triaged
priority: P2
category: perf
target_release: null
created: 2026-06-11
updated: 2026-06-11
depends_on: [FEAT-151]
slices: []
derived_from: docs/superpowers/specs/2026-06-11-slice-perf-2x-3x-design.md
autonomous_safe: false
tags: [perf, quality]
pm_customer_impact: 0.65
pm_effort_estimate: 0.55
pm_strategic_alignment: 0.75
pm_technical_risk: 0.6
pm_dependency_depth: 0.4
composite_score: 0.605
triage_notes: "Bash coalescing rule targets SLICE-67's 305 Bash calls/slice (1.15M cache_create tokens); rule edit + validate-agents lint across 10 primary agent prompts; carve-out language must be carefully written to avoid losing per-step reasoning."
---
# FEAT-157: Bash call coalescing rule + lint

## Description

Phase 2 of the 2-3x slice speedup spec — **blocked by Phase 1 baseline
gate**. SLICE-67 measured 305 Bash calls/slice, each carrying ~4.86×
cache-prime ratio. Volume = 1.15M cache_create tokens. Many are tiny
one-shots that could chain.

Fix: agent prompt rule under Conventions section:

> Coalesce Bash calls. Prefer `cmd1 && cmd2 && cmd3` over sequential
> separate Bash invocations when commands are related and don't need
> intermediate model reasoning. Example: combine
> `git status && git diff --stat && git log --oneline -5` into one
> call, not three. **Carve-out:** use separate calls when each result
> drives the next decision; chain only when commands are pure data
> collection or all-or-nothing.

`scripts/validate-agents.ts` lint flags primary agents missing the rule.

Touches: builder, builder-be, builder-fe, lead, reviewer, validator,
architect, deployer, integrator, researcher prompts.

## Acceptance hints

- Coalescing rule present in all primary agent prompts.
- validate-agents.ts lint catches missing rule (verified via doctored
  agent in temp dir).
- Post-rollout: Bash call count per slice drops from ~305 baseline to
  <200 (~40% reduction).

## Notes

autonomous_safe=false: agent prompt edits. Spec section 2f. Plan Task 10.
