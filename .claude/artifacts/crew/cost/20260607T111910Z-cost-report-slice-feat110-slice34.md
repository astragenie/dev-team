---
kind: cost-report
feature: FEAT-110
run_title: "FEAT110 SLICE34"
usd: 0.5107
duration_ms: 457889
total_tokens: 1465367
cache_hit_pct: 99.6
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T11:19:10.956Z
---

# Cost Report: FEAT110 SLICE34

- Created: 2026-06-07T11:19:10.956Z
- Run Title: FEAT110 SLICE34
- Window Start: 2026-06-07T11:11:32.758Z
- Window End: 2026-06-07T11:19:10.647Z
- Duration: 7.6 min (457889 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 9
- Total Tokens: 1,465,367
- Cache Hit %: 99.6%
- Total USD: $0.5107
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 11
- cache_create_5m: 0
- cache_create_1h: 5,357
- cache_read: 1,457,240
- output: 2,759

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 9 msgs (100%), $0.5107 (99.99%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 1

## Tool Usage

- Bash: 5
- Agent: 1

## Tool Result Sizes (bytes)

- count: 7
- sum: 4,434
- p50: 131
- p90: 2,655
- max: 2,655

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 5 calls, 3,074B results, ~3,001 cache_create tok (0.98×)
- Agent: 1 calls, 1,335B results, ~1,891 cache_create tok (1.42×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 9
- usd: $0.5107
- input: 11
- cache_create_5m: 0
- cache_create_1h: 5,357
- cache_read: 1,457,240
- output: 2,759

