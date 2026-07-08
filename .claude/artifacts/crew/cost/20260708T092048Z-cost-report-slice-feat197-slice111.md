---
kind: cost-report
feature: FEAT-197
run_title: "FEAT197 SLICE111"
usd: 40.619
duration_ms: 3343880
total_tokens: 17623601
cache_hit_pct: 99
source_project: C--work-mega-dev-team
aggregate_all: false
source_count: 1
created_at: 2026-07-08T09:20:48.387Z
---

# Cost Report: FEAT197 SLICE111

- Created: 2026-07-08T09:20:48.387Z
- Run Title: FEAT197 SLICE111
- Window Start: 2026-07-08T08:25:03.879Z
- Window End: 2026-07-08T09:20:47.759Z
- Duration: 55.7 min (3343880 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 74
- Total Tokens: 17,623,601
- Cache Hit %: 99%
- Total USD: $40.6190
- Source Project: C--work-mega-dev-team
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 5,050
- cache_create_5m: 0
- cache_create_1h: 175,874
- cache_read: 17,318,826
- output: 123,851

## Model Mix

- claude-opus-4-8 (priced as claude-opus-4): 74 msgs (100%), $40.6190 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 2
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 6

## Tool Usage

- Bash: 15
- Agent: 6
- Read: 3
- Grep: 2
- Edit: 1
- Write: 1

## Tool Result Sizes (bytes)

- count: 29
- sum: 56,465
- p50: 1,039
- p90: 4,229
- max: 9,219

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 15 calls, 21,378B results, ~78,705 cache_create tok (3.68×)
- Agent: 6 calls, 11,350B results, ~39,879 cache_create tok (3.51×)
- Grep: 2 calls, 8,673B results, ~20,877 cache_create tok (2.41×)
- Read: 3 calls, 5,458B results, ~20,597 cache_create tok (3.77×)
- Write: 1 calls, 238B results, ~2,391 cache_create tok (10.05×)
- Edit: 1 calls, 149B results, ~957 cache_create tok (6.42×)


## By Model (token detail)

### claude-opus-4-8 (priced as claude-opus-4)
- messages: 74
- usd: $40.6190
- input: 5,050
- cache_create_5m: 0
- cache_create_1h: 175,874
- cache_read: 17,318,826
- output: 123,851

