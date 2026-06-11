---
id: FEAT-155
status: triaged
priority: P1
category: perf
target_release: null
created: 2026-06-11
updated: 2026-06-11
depends_on: [FEAT-151]
slices: []
derived_from: docs/superpowers/specs/2026-06-11-slice-perf-2x-3x-design.md
autonomous_safe: false
tags: [perf, quality, observability]
pm_customer_impact: 0.9
pm_effort_estimate: 0.55
pm_strategic_alignment: 0.95
pm_technical_risk: 0.55
pm_dependency_depth: 0.4
triage_notes: "Highest expected cache_create savings (~600K tokens/slice) directly maps to SLICE-67 HIGH severity TaskUpdate burst flag (1750× cache-prime ratio); touches 6 primary agent prompts + new hook + validator lint rule, blocked by Phase 1 baseline."
---
# FEAT-155: TaskUpdate batching rule + burst-detector hook

## Description

Phase 2 of the 2-3x slice speedup spec — **blocked by Phase 1 baseline
gate**. **Highest expected cache_create savings** (~600K tokens/slice)
per SLICE-67 ranking: TaskUpdate showed 1750.62× cache-prime ratio per
call — the worst of any tool, despite only 20 calls = 791K cache_create
tokens.

Two-part fix:

Part 1: agent prompt rule "batch task status changes. Send `in_progress`
for current task only. Coalesce `completed` markers at logical sequence
boundaries — don't fire one per task in tight loop. Never run ≥3
TaskUpdate calls back-to-back without intervening work."

Part 2: new hook `hooks/lib/check-task-update-burst.ts` + entry shim,
detects ≥3 TaskUpdate calls without intervening tools per turn, logs
warning row in `.claude/logs/task-update-bursts.jsonl` (non-blocking
telemetry).

`scripts/validate-agents.ts` lint flags primary agent prompts missing
the batching rule.

## Acceptance hints

- Hook core in-process testable (follow SLICE-67 hook-core extraction
  pattern).
- Test: ≥3 consecutive TaskUpdates → warning written; interleaved →
  no warning.
- Batching rule present in builder, lead, reviewer, validator,
  architect, doc-writer (if exists) prompts.
- validate-agents.ts lint catches missing rule.
- Post-rollout: TaskUpdate cache_create per slice drops ≥60%.

## Notes

Highest-impact Phase 2 FEAT — P1 within Phase 2. autonomous_safe=false:
agent prompt edits. Spec section 2d. Plan Task 8.
