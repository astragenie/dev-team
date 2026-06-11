---
id: FEAT-152
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
pm_effort_estimate: 0.5
pm_strategic_alignment: 0.7
pm_technical_risk: 0.55
pm_dependency_depth: 0.4
composite_score: 0.578
triage_notes: "Parallel bash gates cut validator ~33s → ~12s, but touches 3 agent prompts + blocked by Phase 1 baseline gate; per-gate temp logs + timeout aggregation introduce moderate failure modes (orphaned temp dirs, mktemp portability)."
---
# FEAT-152: Parallel bash gates helper + validator/reviewer wiring

## Description

Phase 2 of the 2-3x slice speedup spec — **blocked by Phase 1 baseline
gate**. Adds `scripts/lib/parallel-gates.ts` emitting a bash block that
runs lint + format:check + typecheck + audit + validate:all
concurrently via `&` + `wait`, with per-gate `mktemp` log + per-gate
`timeout 60` hard cap + exit-code aggregator that prints failed-gate
header + tail.

Currently validator runs gates serially (~33s sum). Parallel runs to
~12s (typecheck dominates).

Touches `agents/validator.md`, `agents/reviewer.md`,
`agents/reviewer-validator.md`: gate-run section calls helper instead
of inline serial bash.

Different from prior spec WS2-2a (parallel reviewer+validator subagent
dispatch). This is parallel *bash* execution within a single agent.

## Acceptance hints

- `emitParallelGatesBlock(["lint","typecheck",...])` returns bash block
  with `( timeout 60 ... ) &` per gate + `wait` aggregator.
- `aggregateGateExitCodes([0,1,0])` returns 1; `[0,0,0]` returns 0.
- Failed gate prints `--- {gate} failed ---` + tail of its log file.
- Per-gate temp log via `mktemp -d` cleaned up at end.
- `bun run scripts/lib/parallel-gates.ts --emit lint,typecheck` prints
  ready-to-execute bash block.
- validator/reviewer/reviewer-validator agent prompts updated to call
  helper.
- Measured wall-clock <15s on a slice where serial took ~33s.

## Notes

autonomous_safe=false: agent prompt edits per CLAUDE.md governance.
Blocked-by: Phase 1 baseline must justify (gates + slowest dispatches
≥50% wall-clock). Spec section 2a. Plan Task 5.
