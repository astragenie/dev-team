---
kind: cost-report
feature: FEAT-196
run_title: "FEAT196 SLICE110"
usd: 5.9494
duration_ms: 845132
total_tokens: 2133621
cache_hit_pct: 98.2
source_project: C--work-mega-dev-team
aggregate_all: false
source_count: 1
created_at: 2026-07-08T08:16:27.270Z
---

# Cost Report: FEAT196 SLICE110

- Created: 2026-07-08T08:16:27.270Z
- Run Title: FEAT196 SLICE110
- Window Start: 2026-07-08T08:02:21.657Z
- Window End: 2026-07-08T08:16:26.789Z
- Duration: 14.1 min (845132 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 12
- Total Tokens: 2,133,621
- Cache Hit %: 98.2%
- Total USD: $5.9494
- Source Project: C--work-mega-dev-team
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 24
- cache_create_5m: 0
- cache_create_1h: 38,889
- cache_read: 2,072,391
- output: 22,317

## Model Mix

- claude-opus-4-8 (priced as claude-opus-4): 12 msgs (100%), $5.9494 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 2
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 3

## Tool Usage

- Agent: 3
- Bash: 1

## Tool Result Sizes (bytes)

- count: 5
- sum: 18,353
- p50: 2,383
- p90: 10,733
- max: 10,733

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Agent: 3 calls, 6,708B results, ~17,013 cache_create tok (2.54×)
- Bash: 1 calls, 912B results, ~7,566 cache_create tok (8.3×)


## By Model (token detail)

### claude-opus-4-8 (priced as claude-opus-4)
- messages: 12
- usd: $5.9494
- input: 24
- cache_create_5m: 0
- cache_create_1h: 38,889
- cache_read: 2,072,391
- output: 22,317

