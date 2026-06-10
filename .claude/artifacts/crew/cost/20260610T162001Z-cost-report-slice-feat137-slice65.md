---
kind: cost-report
feature: FEAT-137
run_title: "FEAT137 SLICE65"
usd: 3.2182
duration_ms: 922710
total_tokens: 8801320
cache_hit_pct: 99.5
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-10T16:20:01.331Z
---

# Cost Report: FEAT137 SLICE65

- Created: 2026-06-10T16:20:01.331Z
- Run Title: FEAT137 SLICE65
- Window Start: 2026-06-10T16:04:38.086Z
- Window End: 2026-06-10T16:20:00.796Z
- Duration: 15.4 min (922710 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 24
- Total Tokens: 8,801,320
- Cache Hit %: 99.5%
- Total USD: $3.2182
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 435
- cache_create_5m: 0
- cache_create_1h: 41,025
- cache_read: 8,736,541
- output: 23,319

## Model Mix

- claude-fable-5 (priced as claude-sonnet-4): 24 msgs (100%), $3.2182 (100%)

## Conversation Shape

- user_msg_count: 2
- user_msg_avg_len: 25
- turns_before_first_tool: 2
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 6

## Tool Usage

- Agent: 6 (2 failed)
- PowerShell: 3
- Read: 1

## Tool Result Sizes (bytes)

- count: 11
- sum: 17,305
- p50: 1,736
- p90: 2,343
- max: 4,458

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Agent: 6 calls, 10,665B results, ~32,954 cache_create tok (3.09×)
- PowerShell: 3 calls, 1,562B results, ~4,480 cache_create tok (2.87×)
- Read: 1 calls, 4,458B results, ~2,088 cache_create tok (0.47×)


## By Model (token detail)

### claude-fable-5 (priced as claude-sonnet-4)
- messages: 24
- usd: $3.2182
- input: 435
- cache_create_5m: 0
- cache_create_1h: 41,025
- cache_read: 8,736,541
- output: 23,319

