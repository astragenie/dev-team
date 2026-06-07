---
kind: cost-report
feature: FEAT-109
run_title: "FEAT109 SLICE33"
usd: 1.1112
duration_ms: 543455
total_tokens: 2836335
cache_hit_pct: 99.2
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T11:10:33.527Z
---

# Cost Report: FEAT109 SLICE33

- Created: 2026-06-07T11:10:33.527Z
- Run Title: FEAT109 SLICE33
- Window Start: 2026-06-07T11:01:29.745Z
- Window End: 2026-06-07T11:10:33.200Z
- Duration: 9.1 min (543455 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 19
- Total Tokens: 2,836,335
- Cache Hit %: 99.2%
- Total USD: $1.1112
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 23
- cache_create_5m: 0
- cache_create_1h: 21,876
- cache_read: 2,805,216
- output: 9,220

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 19 msgs (100%), $1.1112 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 1

## Tool Usage

- Bash: 8
- Read: 3
- Agent: 1

## Tool Result Sizes (bytes)

- count: 13
- sum: 16,871
- p50: 312
- p90: 4,439
- max: 4,620

## File Re-reads

- redundant_read_count: 2
- top paths:
  - 3× C:\work\mega\hero-crew\scripts\lib\cost-hygiene\emit-cost-report.ts

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Read: 3 calls, 8,423B results, ~7,811 cache_create tok (0.93×)
- Bash: 8 calls, 6,554B results, ~6,939 cache_create tok (1.06×)
- Agent: 1 calls, 1,886B results, ~6,926 cache_create tok (3.67×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 19
- usd: $1.1112
- input: 23
- cache_create_5m: 0
- cache_create_1h: 21,876
- cache_read: 2,805,216
- output: 9,220

