---
kind: cost-report
feature: FEAT-100
run_title: "FEAT100 SLICE16"
usd: 3.0367
duration_ms: 559106
total_tokens: 6602052
cache_hit_pct: 98.4
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T09:34:33.297Z
---

# Cost Report: FEAT100 SLICE16

- Created: 2026-06-07T09:34:33.297Z
- Run Title: FEAT100 SLICE16
- Window Start: 2026-06-07T09:25:13.907Z
- Window End: 2026-06-07T09:34:33.013Z
- Duration: 9.3 min (559106 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 60
- Total Tokens: 6,602,052
- Cache Hit %: 98.4%
- Total USD: $3.0367
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 2,306
- cache_create_5m: 0
- cache_create_1h: 101,636
- cache_read: 6,466,099
- output: 32,011

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 60 msgs (100%), $3.0367 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 2
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 1

## Tool Usage

- Bash: 26 (2 failed)
- Read: 8
- Edit: 2
- Agent: 1
- Write: 1

## Tool Result Sizes (bytes)

- count: 39
- sum: 64,004
- p50: 138
- p90: 3,265
- max: 37,077

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Read: 8 calls, 53,559B results, ~58,329 cache_create tok (1.09×)
- Bash: 26 calls, 7,543B results, ~26,199 cache_create tok (3.47×)
- Agent: 1 calls, 251B results, ~11,838 cache_create tok (47.16×)
- Write: 1 calls, 161B results, ~1,820 cache_create tok (11.3×)
- Edit: 2 calls, 276B results, ~840 cache_create tok (3.04×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 60
- usd: $3.0367
- input: 2,306
- cache_create_5m: 0
- cache_create_1h: 101,636
- cache_read: 6,466,099
- output: 32,011

