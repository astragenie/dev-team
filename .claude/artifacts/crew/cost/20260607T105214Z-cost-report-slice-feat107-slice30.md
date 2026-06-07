---
kind: cost-report
feature: FEAT-107
run_title: "FEAT107 SLICE30"
usd: 0.9686
duration_ms: 539472
total_tokens: 2474837
cache_hit_pct: 99.2
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T10:52:14.923Z
---

# Cost Report: FEAT107 SLICE30

- Created: 2026-06-07T10:52:14.923Z
- Run Title: FEAT107 SLICE30
- Window Start: 2026-06-07T10:43:15.114Z
- Window End: 2026-06-07T10:52:14.586Z
- Duration: 9.0 min (539472 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 21
- Total Tokens: 2,474,837
- Cache Hit %: 99.2%
- Total USD: $0.9686
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 25
- cache_create_5m: 0
- cache_create_1h: 18,609
- cache_read: 2,448,038
- output: 8,165

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 21 msgs (100%), $0.9686 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 2

## Tool Usage

- Bash: 11 (1 failed)
- Agent: 2
- Read: 1

## Tool Result Sizes (bytes)

- count: 15
- sum: 17,051
- p50: 134
- p90: 1,820
- max: 10,369

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 11 calls, 13,367B results, ~12,382 cache_create tok (0.93×)
- Agent: 2 calls, 2,290B results, ~4,804 cache_create tok (2.1×)
- Read: 1 calls, 1,305B results, ~1,226 cache_create tok (0.94×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 21
- usd: $0.9686
- input: 25
- cache_create_5m: 0
- cache_create_1h: 18,609
- cache_read: 2,448,038
- output: 8,165

