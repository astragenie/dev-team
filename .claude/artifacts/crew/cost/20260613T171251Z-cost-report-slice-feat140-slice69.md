---
kind: cost-report
feature: FEAT-140
run_title: "FEAT140 SLICE69"
usd: 18.1231
duration_ms: 2002273
total_tokens: 7944227
cache_hit_pct: 98.6
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-13T17:12:51.467Z
---

# Cost Report: FEAT140 SLICE69

- Created: 2026-06-13T17:12:51.467Z
- Run Title: FEAT140 SLICE69
- Window Start: 2026-06-13T16:38:53.933Z
- Window End: 2026-06-13T17:12:16.206Z
- Duration: 33.4 min (2002273 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 32
- Total Tokens: 7,944,227
- Cache Hit %: 98.6%
- Total USD: $18.1231
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 7,720
- cache_create_5m: 0
- cache_create_1h: 102,712
- cache_read: 7,790,595
- output: 43,200

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 32 msgs (100%), $18.1231 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 2
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 6

## Tool Usage

- Agent: 6
- Bash: 5
- Read: 2
- AskUserQuestion: 1

## Tool Result Sizes (bytes)

- count: 14
- sum: 38,711
- p50: 984
- p90: 6,379
- max: 23,476

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Agent: 5 calls, 11,209B results, ~49,926 cache_create tok (4.45×)
- Bash: 5 calls, 1,789B results, ~16,537 cache_create tok (9.24×)
- AskUserQuestion: 1 calls, 157B results, ~2,930 cache_create tok (18.66×)
- Read: 2 calls, 2,080B results, ~2,080 cache_create tok (1×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 32
- usd: $18.1231
- input: 7,720
- cache_create_5m: 0
- cache_create_1h: 102,712
- cache_read: 7,790,595
- output: 43,200

