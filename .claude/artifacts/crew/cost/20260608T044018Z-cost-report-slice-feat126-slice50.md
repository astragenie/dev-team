---
kind: cost-report
feature: FEAT-126
run_title: "FEAT126 SLICE50"
usd: 3.1713
duration_ms: 469501
total_tokens: 1709109
cache_hit_pct: 99.6
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-08T04:40:18.920Z
---

# Cost Report: FEAT126 SLICE50

- Created: 2026-06-08T04:40:18.920Z
- Run Title: FEAT126 SLICE50
- Window Start: 2026-06-08T04:32:28.948Z
- Window End: 2026-06-08T04:40:18.449Z
- Duration: 7.8 min (469501 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 8
- Total Tokens: 1,709,109
- Cache Hit %: 99.6%
- Total USD: $3.1713
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 8
- cache_create_5m: 0
- cache_create_1h: 6,169
- cache_read: 1,697,059
- output: 5,873

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 8 msgs (100%), $3.1713 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 2

## Tool Usage

- TaskUpdate: 4
- Agent: 2
- Read: 1
- Write: 1

## Tool Result Sizes (bytes)

- count: 9
- sum: 8,203
- p50: 89
- p90: 6,167
- max: 6,167

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Write: 1 calls, 191B results, ~2,540 cache_create tok (13.3×)
- Agent: 2 calls, 6,714B results, ~2,242 cache_create tok (0.33×)
- TaskUpdate: 4 calls, 88B results, ~448 cache_create tok (5.09×)
- Read: 1 calls, 89B results, ~200 cache_create tok (2.25×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 8
- usd: $3.1713
- input: 8
- cache_create_5m: 0
- cache_create_1h: 6,169
- cache_read: 1,697,059
- output: 5,873

