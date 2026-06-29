---
kind: cost-report
run_title: "SLICE108"
usd: 68.1956
duration_ms: 3557511
total_tokens: 40458331
cache_hit_pct: 99.7
source_project: C--work-mega-dev-team
aggregate_all: false
source_count: 1
created_at: 2026-06-29T12:23:04.480Z
---

# Cost Report: SLICE108

- Created: 2026-06-29T12:23:04.480Z
- Run Title: SLICE108
- Window Start: 2026-06-29T11:23:46.873Z
- Window End: 2026-06-29T12:23:04.384Z
- Duration: 59.3 min (3557511 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 85
- Total Tokens: 40,458,331
- Cache Hit %: 99.7%
- Total USD: $68.1956
- Source Project: C--work-mega-dev-team
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 200
- cache_create_5m: 0
- cache_create_1h: 119,088
- cache_read: 40,283,106
- output: 55,937

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 85 msgs (100%), $68.1956 (100%)

## Conversation Shape

- user_msg_count: 9
- user_msg_avg_len: 541
- turns_before_first_tool: 2
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 2

## Tool Usage

- Bash: 24
- Edit: 6
- Agent: 2
- SendMessage: 2
- Read: 2

## Tool Result Sizes (bytes)

- count: 36
- sum: 38,607
- p50: 508
- p90: 1,231
- max: 15,600

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 23 calls, 12,752B results, ~41,564 cache_create tok (3.26×)
- SendMessage: 2 calls, 760B results, ~26,364 cache_create tok (34.69×)
- Agent: 2 calls, 1,215B results, ~15,720 cache_create tok (12.94×)
- Read: 2 calls, 7,365B results, ~7,918 cache_create tok (1.08×)
- Edit: 6 calls, 915B results, ~6,012 cache_create tok (6.57×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 85
- usd: $68.1956
- input: 200
- cache_create_5m: 0
- cache_create_1h: 119,088
- cache_read: 40,283,106
- output: 55,937

