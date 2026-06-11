---
id: FEAT-149
status: pending
priority: P2
category: observability
target_release: null
created: 2026-06-11
updated: 2026-06-11
depends_on: []
slices: []
derived_from: docs/superpowers/specs/2026-06-11-slice-perf-2x-3x-design.md
autonomous_safe: true
tags: [perf, observability, telemetry]
---
# FEAT-149: Dispatch-timing wrapper + JSONL writer

## Description

Phase 1 of the 2-3x slice speedup spec. Adds per-subagent-dispatch
wall-clock + tool-call + token telemetry. New
`scripts/lib/dispatch-timing.ts` exports `recordDispatchStart(meta)` and
`recordDispatchEnd(meta)`. Hook tap in
`hooks/lib/check-subagent-return.ts` calls them. One JSONL row per
dispatch lands in `.claude/logs/dispatch-timing.jsonl` (gitignored).

Pure additive. No behavior change. Foundation for Phase 1 baseline
and the Phase 2 promotion gate (top-3 slowest + bash gates ≥50% of
slice wall-clock).

## Acceptance hints

- `recordDispatchStart` / `recordDispatchEnd` exported from new lib file.
- JSONL row contains: runId, sliceId, agent, model, startMs, wallMs,
  toolCalls (per-tool count map), bashDurationMs, skillLoadCount, tokenIn,
  tokenOut.
- Unit test under fixed clock confirms row shape + wallMs accuracy.
- Hook tap in check-subagent-return.ts is fire-and-forget (no blocking).
- e2e-smoke writes ≥1 row when smoke spawns a subagent.
- Per-worktree log path (`$CLAUDE_PLUGIN_ROOT/.claude/logs/`) so parallel
  worktrees don't race.

## Notes

Spec: `docs/superpowers/specs/2026-06-11-slice-perf-2x-3x-design.md`
section 1a. Plan: `docs/superpowers/plans/2026-06-11-slice-perf-2x-3x.md`
Task 1.
