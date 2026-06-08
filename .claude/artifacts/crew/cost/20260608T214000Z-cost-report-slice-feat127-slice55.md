---
kind: cost-report
feature: FEAT-127
run_title: "FEAT127 SLICE55"
usd: 0.1806
duration_ms: 294188
total_tokens: 470646
cache_hit_pct: 99.5
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-08T21:40:00.195Z
---

# Cost Report: FEAT127 SLICE55

- Created: 2026-06-08T21:40:00.195Z
- Run Title: FEAT127 SLICE55
- Window Start: 2026-06-08T21:35:05.528Z
- Window End: 2026-06-08T21:39:59.716Z
- Duration: 4.9 min (294188 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 3
- Total Tokens: 470,646
- Cache Hit %: 99.5%
- Total USD: $0.1806
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 3
- cache_create_5m: 0
- cache_create_1h: 2,351
- cache_read: 466,526
- output: 1,766

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 3 msgs (100%), $0.1806 (100.02%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 2

## Tool Usage

- Agent: 2
- Bash: 1

## Tool Result Sizes (bytes)

- count: 3
- sum: 2,042
- p50: 522
- p90: 1,431
- max: 1,431

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Agent: 2 calls, 1,953B results, ~2,125 cache_create tok (1.09×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 3
- usd: $0.1806
- input: 3
- cache_create_5m: 0
- cache_create_1h: 2,351
- cache_read: 466,526
- output: 1,766

