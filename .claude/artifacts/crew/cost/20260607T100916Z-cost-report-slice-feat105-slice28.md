---
kind: cost-report
feature: FEAT-105
run_title: "FEAT105 SLICE28"
usd: 2.6256
duration_ms: 374124
total_tokens: 6930589
cache_hit_pct: 99.4
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T10:09:16.215Z
---

# Cost Report: FEAT105 SLICE28

- Created: 2026-06-07T10:09:16.215Z
- Run Title: FEAT105 SLICE28
- Window Start: 2026-06-07T10:03:01.776Z
- Window End: 2026-06-07T10:09:15.900Z
- Duration: 6.2 min (374124 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 86
- Total Tokens: 6,930,589
- Cache Hit %: 99.4%
- Total USD: $2.6256
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 86
- cache_create_5m: 0
- cache_create_1h: 42,136
- cache_read: 6,867,549
- output: 20,818

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 86 msgs (100%), $2.6256 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 0

## Tool Usage

- Bash: 29 (1 failed)
- Read: 18
- Edit: 9
- Write: 2

## Tool Result Sizes (bytes)

- count: 59
- sum: 36,935
- p50: 378
- p90: 1,752
- max: 4,047

## File Re-reads

- redundant_read_count: 9
- top paths:
  - 3× C:\work\mega\hero-crew\scripts\lib\workflow-state.mjs
  - 3× C:\work\mega\hero-crew\scripts\lib\wakeup.mjs
  - 3× C:\work\mega\hero-crew\scripts\lib\briefing\collect.mjs
  - 2× C:\work\mega\hero-crew\docs\ai-loop\slices\pending\SLICE_28_FEAT-105-PERF-WIN-10-SKIP-STAT-BEFORE-READ.md
  - 2× C:\work\mega\hero-crew\scripts\lib\deployment-guidance.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 29 calls, 17,357B results, ~20,126 cache_create tok (1.16×)
- Read: 18 calls, 15,753B results, ~14,217 cache_create tok (0.9×)
- Edit: 9 calls, 1,450B results, ~5,337 cache_create tok (3.68×)
- Write: 2 calls, 285B results, ~1,391 cache_create tok (4.88×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 86
- usd: $2.6256
- input: 86
- cache_create_5m: 0
- cache_create_1h: 42,136
- cache_read: 6,867,549
- output: 20,818

