---
kind: cost-report
feature: FEAT-128
run_title: "FEAT128 SLICE56"
usd: 0.2025
duration_ms: 417987
total_tokens: 485232
cache_hit_pct: 99.1
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-08T21:47:29.177Z
---

# Cost Report: FEAT128 SLICE56

- Created: 2026-06-08T21:47:29.177Z
- Run Title: FEAT128 SLICE56
- Window Start: 2026-06-08T21:40:30.796Z
- Window End: 2026-06-08T21:47:28.783Z
- Duration: 7.0 min (417987 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 3
- Total Tokens: 485,232
- Cache Hit %: 99.1%
- Total USD: $0.2025
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 7
- cache_create_5m: 0
- cache_create_1h: 4,389
- cache_read: 478,667
- output: 2,169

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 3 msgs (100%), $0.2025 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 2

## Tool Usage

- Agent: 2

## Tool Result Sizes (bytes)

- count: 3
- sum: 3,433
- p50: 1,171
- p90: 2,173
- max: 2,173

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Agent: 2 calls, 3,344B results, ~4,064 cache_create tok (1.22×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 3
- usd: $0.2025
- input: 7
- cache_create_5m: 0
- cache_create_1h: 4,389
- cache_read: 478,667
- output: 2,169

