---
kind: cost-report
feature: FEAT-107
run_title: "FEAT107 SLICE30"
usd: 1.0086
duration_ms: 543216
total_tokens: 2596237
cache_hit_pct: 99.3
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T10:52:18.641Z
---

# Cost Report: FEAT107 SLICE30

- Created: 2026-06-07T10:52:18.641Z
- Run Title: FEAT107 SLICE30
- Window Start: 2026-06-07T10:43:15.114Z
- Window End: 2026-06-07T10:52:18.330Z
- Duration: 9.1 min (543216 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 22
- Total Tokens: 2,596,237
- Cache Hit %: 99.3%
- Total USD: $1.0086
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 26
- cache_create_5m: 0
- cache_create_1h: 18,802
- cache_read: 2,569,077
- output: 8,332

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 22 msgs (100%), $1.0086 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 2

## Tool Usage

- Bash: 12 (2 failed)
- Agent: 2
- Read: 1

## Tool Result Sizes (bytes)

- count: 16
- sum: 17,357
- p50: 281
- p90: 1,820
- max: 10,369

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 12 calls, 13,673B results, ~12,575 cache_create tok (0.92×)
- Agent: 2 calls, 2,290B results, ~4,804 cache_create tok (2.1×)
- Read: 1 calls, 1,305B results, ~1,226 cache_create tok (0.94×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 22
- usd: $1.0086
- input: 26
- cache_create_5m: 0
- cache_create_1h: 18,802
- cache_read: 2,569,077
- output: 8,332

