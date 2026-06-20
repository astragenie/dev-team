---
feature: FEAT-159
status: active
---
# Run Brief: FEAT159 SLICE84: FEAT-159 SLICE-A — Per-agent rolling stats aggregator + CLI (no lead integration)

- Created: 2026-06-20T08:24:44.702Z
- Tier: full
- Goal: Build the read-only aggregation substrate for per-agent rolling stats over the existing Phase 1 telemetry (`dispatch-timing.jsonl`, `bash-gates.jsonl`, slice grade JSON, review/validation artifacts). Emit a versioned JSON artifact per run under `.claude/artifacts/crew/agent-stats/` and expose an ad-hoc lookup CLI. Lead consumption is intentionally NOT wired here — that's a follow-up `autonomous_safe: false` slice.
- Mode: autonomous
- Pace: unattended
- Owner: loop
- Status: active
- Summary: -
- Scope:
  - ### 1. New: `scripts/lib/agent-stats-aggregator.ts` (≤250 lines)

Pure-function module. No I/O at the top level — file reads happen inside named async functions so callers can stub fixtures. Exports:

- `type AgentStatsRow` — the per-agent record shape:
  ```ts
  {
    agent: string;
    window: string;              // e.g. "last_10_slices"
    sample_count: number;        // dispatches matched in window
    pass_rate: number;           // 0..1
  - dispatches whose slice graded >= 0.7 avg
    mean_wall_ms: number;
    mean_tokens: number;         // mean(tokenIn + tokenOut)
    review_rework_rate: number;  // 0..1
  - fraction with >= 1 review_needs_fix artifact
    validation_fail_rate: number;// 0..1
  - fraction with >= 1 validation_fail artifact
    median_dispatches_to_pass: number; // per-sli
- Out Of Scope: -
- Planned Files: -
- Next Step: Begin implementation

