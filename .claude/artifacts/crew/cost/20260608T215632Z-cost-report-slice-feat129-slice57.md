---
kind: cost-report
feature: FEAT-129
run_title: "FEAT129 SLICE57"
usd: 0.1894
duration_ms: 517995
total_tokens: 498241
cache_hit_pct: 99.5
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-08T21:56:32.863Z
---

# Cost Report: FEAT129 SLICE57

- Created: 2026-06-08T21:56:32.863Z
- Run Title: FEAT129 SLICE57
- Window Start: 2026-06-08T21:47:54.487Z
- Window End: 2026-06-08T21:56:32.482Z
- Duration: 8.6 min (517995 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 3
- Total Tokens: 498,241
- Cache Hit %: 99.5%
- Total USD: $0.1894
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 7
- cache_create_5m: 0
- cache_create_1h: 2,714
- cache_read: 493,856
- output: 1,664

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 3 msgs (100%), $0.1894 (99.99%)

## Conversation Shape

- user_msg_count: 1
- user_msg_avg_len: 12004
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 2

## Tool Usage

- Agent: 2

## Tool Result Sizes (bytes)

- count: 3
- sum: 2,747
- p50: 1,298
- p90: 1,360
- max: 1,360

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Agent: 2 calls, 2,658B results, ~2,488 cache_create tok (0.94×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 3
- usd: $0.1894
- input: 7
- cache_create_5m: 0
- cache_create_1h: 2,714
- cache_read: 493,856
- output: 1,664

