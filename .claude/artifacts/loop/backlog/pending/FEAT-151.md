---
id: FEAT-151
status: pending
priority: P2
category: observability
target_release: null
created: 2026-06-11
updated: 2026-06-11
depends_on: [FEAT-149, FEAT-150]
slices: []
derived_from: docs/superpowers/specs/2026-06-11-slice-perf-2x-3x-design.md
autonomous_safe: true
tags: [perf, observability]
---
# FEAT-151: Cost-report per-dispatch breakdown section

## Description

Phase 1 of the 2-3x slice speedup spec. Extends
`scripts/crew.ts write-cost-report` to append a new "Per-dispatch
breakdown" section: top-3 slowest dispatches, top-3 token-heaviest
dispatches, total bash gate time, per-gate breakdown, skill-load count
per agent. Reads from `dispatch-timing.jsonl` (FEAT-149) and
`bash-gates.jsonl` (FEAT-150) filtered by current runId.

Backward compatible: section appended, no removals. Toggle via env
`CREW_COST_REPORT_DISPATCH_DETAIL=0` if noisy.

Completes Phase 1 telemetry. After 3 slices with this section
populated, write `.claude/artifacts/loop/baselines/phase-1-perf-baseline.md`
to gate Phase 2.

## Acceptance hints

- New aggregator `scripts/lib/dispatch-timing-reader.ts` exports
  `aggregateDispatchTiming(logPath, runId)` returning rowCount,
  totalWallMs, topSlow[], topTokens[].
- `scripts/crew.ts write-cost-report` renders new section after the
  existing "By Model" block.
- CLI test confirms section appears with expected tables.
- env `CREW_COST_REPORT_DISPATCH_DETAIL=0` suppresses the section.

## Notes

Depends on FEAT-149 (dispatch-timing.jsonl) and FEAT-150 (bash-gates.jsonl)
to have data sources. Spec section 1c. Plan Task 3.
