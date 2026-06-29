---
kind: cost-report
run_title: "SLICE94"
usd: 219.9554
duration_ms: 20481011
total_tokens: 113934961
cache_hit_pct: 98.8
source_project: C--work-mega-dev-team
aggregate_all: false
source_count: 1
created_at: 2026-06-29T17:05:07.975Z
---

# Cost Report: SLICE94

- Created: 2026-06-29T17:05:07.975Z
- Run Title: SLICE94
- Window Start: 2026-06-29T11:23:46.873Z
- Window End: 2026-06-29T17:05:07.884Z
- Duration: 341.4 min (20481011 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 221
- Total Tokens: 113,934,961
- Cache Hit %: 98.8%
- Total USD: $219.9554
- Source Project: C--work-mega-dev-team
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 441
- cache_create_5m: 0
- cache_create_1h: 1,336,783
- cache_read: 112,448,775
- output: 148,962

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 221 msgs (100%), $219.9554 (100%)

## Conversation Shape

- user_msg_count: 18
- user_msg_avg_len: 534
- turns_before_first_tool: 2
- compaction_count: 1
- skill_invocations: 0
- subagent_dispatches: 4

## Tool Usage

- Bash: 73
- Edit: 12 (1 failed)
- Read: 7
- Agent: 4
- Write: 3
- SendMessage: 2
- ScheduleWakeup: 1

## Tool Result Sizes (bytes)

- count: 102
- sum: 110,063
- p50: 423
- p90: 1,502
- max: 25,266

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 72 calls, 71,512B results, ~1,227,645 cache_create tok (17.17×)
- SendMessage: 2 calls, 760B results, ~26,364 cache_create tok (34.69×)
- Agent: 4 calls, 2,971B results, ~25,271 cache_create tok (8.51×)
- Read: 7 calls, 16,710B results, ~17,102 cache_create tok (1.02×)
- Edit: 12 calls, 1,791B results, ~10,209 cache_create tok (5.7×)
- Write: 3 calls, 562B results, ~7,310 cache_create tok (13.01×)
- ScheduleWakeup: 1 calls, 157B results, ~1,372 cache_create tok (8.74×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 221
- usd: $219.9554
- input: 441
- cache_create_5m: 0
- cache_create_1h: 1,336,783
- cache_read: 112,448,775
- output: 148,962

