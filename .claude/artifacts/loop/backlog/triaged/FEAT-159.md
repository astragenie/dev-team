---
id: FEAT-159
status: triaged
priority: P2
category: observability
target_release: null
created: 2026-06-11
updated: 2026-06-11
depends_on: [FEAT-151]
slices: []
derived_from: null
autonomous_safe: true
tags: [perf, observability, lead-orchestration, metrics]
pm_customer_impact: 0.55
pm_effort_estimate: 0.55
pm_strategic_alignment: 0.7
pm_technical_risk: 0.7
pm_dependency_depth: 0.4
triage_notes: "Per-agent rolling stats aggregator from OpenAI review feedback: pure additive layer over Phase 1 telemetry (autonomous_safe=true claimed in body), but requires FEAT-149/150/151 data first; CLI + report section + new artifact tree is moderate scope."
---
# FEAT-159: Lead metrics + learning loop (per-agent rolling stats)

## Description

OpenAI review (8.7/10) flagged "no learning/feedback loop" as a
weak point. Current lead dispatches → review → validate → done with
no memory. Missing per-agent performance signals that would let
the orchestrator self-improve over time.

Builds on Phase 1 telemetry already wired:
- `dispatch-timing.jsonl` (FEAT-149): per-subagent wall-clock + tool
  counts + tokens.
- `bash-gates.jsonl` (FEAT-150): per-gate duration + exit code.
- Cost-report Per-dispatch breakdown (FEAT-151): top-3 slowest +
  token-heaviest + bash gate totals per slice.

This FEAT adds a rolling aggregator that consumes those JSONL files
and writes a structured "agent stats" artifact:

```json
{
  "agent": "crew:builder",
  "window": "last_10_slices",
  "pass_rate": 0.93,
  "mean_wall_ms": 45200,
  "mean_tokens": 60000,
  "review_rework_rate": 0.12,
  "validation_fail_rate": 0.04,
  "median_dispatches_to_pass": 1
}
```

Lead reads the aggregate at slice start (Step 3 model/agent picking)
to inform: which builder variant is rework-prone? When should Opus
be preferred? Which reviewer lenses miss what?

## Acceptance hints

- New `scripts/lib/agent-stats-aggregator.ts` reads
  `dispatch-timing.jsonl` + `bash-gates.jsonl` + slice grade scores
  + review/validation decision artifacts → emits rolling stats.
- Configurable window (default last_10_slices; env override
  `CREW_AGENT_STATS_WINDOW`).
- Cost-report writer appends agent-stats summary section.
- New `node scripts/crew.ts agent-stats --agent <name>` CLI for
  ad-hoc lookup.
- Unit tests cover aggregation with seeded JSONL + grade data.
- Stats artifact written under `.claude/artifacts/crew/agent-stats/`.

## Notes

Depends on FEAT-149/150/151 (Phase 1 telemetry) being live in the
worktree to have data sources. autonomous_safe=true — pure additive
aggregation layer, no agent prompt edits. Source: OpenAI review
2026-06-11 commit `f554a16`.
