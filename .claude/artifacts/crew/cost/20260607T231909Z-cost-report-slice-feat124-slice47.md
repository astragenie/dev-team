---
kind: cost-report
feature: FEAT-124
run_title: "FEAT124 SLICE47"
usd: 19.1155
duration_ms: 824898
total_tokens: 9744828
cache_hit_pct: 99.3
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T23:19:09.594Z
---

# Cost Report: FEAT124 SLICE47

- Created: 2026-06-07T23:19:09.594Z
- Run Title: FEAT124 SLICE47
- Window Start: 2026-06-07T23:05:24.342Z
- Window End: 2026-06-07T23:19:09.240Z
- Duration: 13.7 min (824898 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 59
- Total Tokens: 9,744,828
- Cache Hit %: 99.3%
- Total USD: $19.1155
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 59
- cache_create_5m: 0
- cache_create_1h: 63,203
- cache_read: 9,644,884
- output: 36,682

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 59 msgs (100%), $19.1155 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 2

## Tool Usage

- Bash: 19
- Edit: 6
- Read: 3
- Agent: 2

## Tool Result Sizes (bytes)

- count: 31
- sum: 18,357
- p50: 369
- p90: 1,059
- max: 3,571

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 19 calls, 9,250B results, ~28,877 cache_create tok (3.12×)
- Agent: 2 calls, 3,972B results, ~17,985 cache_create tok (4.53×)
- Edit: 6 calls, 981B results, ~10,652 cache_create tok (10.86×)
- Read: 3 calls, 3,095B results, ~4,881 cache_create tok (1.58×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 59
- usd: $19.1155
- input: 59
- cache_create_5m: 0
- cache_create_1h: 63,203
- cache_read: 9,644,884
- output: 36,682

