---
kind: cost-report
run_title: "SLICE95"
usd: 224.6745
duration_ms: 20528810
total_tokens: 116831911
cache_hit_pct: 98.9
source_project: C--work-mega-dev-team
aggregate_all: false
source_count: 1
created_at: 2026-06-29T17:05:55.786Z
---

# Cost Report: SLICE95

- Created: 2026-06-29T17:05:55.786Z
- Run Title: SLICE95
- Window Start: 2026-06-29T11:23:46.873Z
- Window End: 2026-06-29T17:05:55.683Z
- Duration: 342.1 min (20528810 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 226
- Total Tokens: 116,831,911
- Cache Hit %: 98.9%
- Total USD: $224.6745
- Source Project: C--work-mega-dev-team
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 446
- cache_create_5m: 0
- cache_create_1h: 1,340,179
- cache_read: 115,338,558
- output: 152,728

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 226 msgs (100%), $224.6745 (100%)

## Conversation Shape

- user_msg_count: 18
- user_msg_avg_len: 534
- turns_before_first_tool: 2
- compaction_count: 1
- skill_invocations: 0
- subagent_dispatches: 4

## Tool Usage

- Bash: 75
- Edit: 12 (1 failed)
- Read: 7
- Agent: 4
- Write: 4
- SendMessage: 2
- ScheduleWakeup: 1

## Tool Result Sizes (bytes)

- count: 105
- sum: 111,041
- p50: 409
- p90: 1,502
- max: 25,266

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 74 calls, 72,306B results, ~1,229,531 cache_create tok (17×)
- SendMessage: 2 calls, 760B results, ~26,364 cache_create tok (34.69×)
- Agent: 4 calls, 2,971B results, ~25,271 cache_create tok (8.51×)
- Read: 7 calls, 16,710B results, ~17,102 cache_create tok (1.02×)
- Edit: 12 calls, 1,791B results, ~10,209 cache_create tok (5.7×)
- Write: 4 calls, 746B results, ~8,820 cache_create tok (11.82×)
- ScheduleWakeup: 1 calls, 157B results, ~1,372 cache_create tok (8.74×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 226
- usd: $224.6745
- input: 446
- cache_create_5m: 0
- cache_create_1h: 1,340,179
- cache_read: 115,338,558
- output: 152,728

