---
kind: cost-report
feature: FEAT-100
run_title: "FEAT100 SLICE16"
usd: 3.4315
duration_ms: 590063
total_tokens: 7582355
cache_hit_pct: 98.5
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T09:35:04.256Z
---

# Cost Report: FEAT100 SLICE16

- Created: 2026-06-07T09:35:04.256Z
- Run Title: FEAT100 SLICE16
- Window Start: 2026-06-07T09:25:13.907Z
- Window End: 2026-06-07T09:35:03.970Z
- Duration: 9.8 min (590063 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 68
- Total Tokens: 7,582,355
- Cache Hit %: 98.5%
- Total USD: $3.4315
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 2,314
- cache_create_5m: 0
- cache_create_1h: 113,076
- cache_read: 7,432,543
- output: 34,422

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 68 msgs (100%), $3.4315 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 2
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 1

## Tool Usage

- Bash: 29 (3 failed)
- Read: 9
- Edit: 3
- Agent: 1
- Write: 1

## Tool Result Sizes (bytes)

- count: 44
- sum: 72,488
- p50: 161
- p90: 3,265
- max: 37,077

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Read: 9 calls, 53,633B results, ~58,489 cache_create tok (1.09×)
- Bash: 29 calls, 15,742B results, ~37,236 cache_create tok (2.37×)
- Agent: 1 calls, 251B results, ~11,838 cache_create tok (47.16×)
- Write: 1 calls, 161B results, ~1,820 cache_create tok (11.3×)
- Edit: 3 calls, 487B results, ~1,083 cache_create tok (2.22×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 68
- usd: $3.4315
- input: 2,314
- cache_create_5m: 0
- cache_create_1h: 113,076
- cache_read: 7,432,543
- output: 34,422

