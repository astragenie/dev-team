---
kind: cost-report
feature: FEAT-117
run_title: "FEAT117 SLICE41"
usd: 1.0066
duration_ms: 712462
total_tokens: 2598070
cache_hit_pct: 99.3
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T14:51:41.485Z
---

# Cost Report: FEAT117 SLICE41

- Created: 2026-06-07T14:51:41.485Z
- Run Title: FEAT117 SLICE41
- Window Start: 2026-06-07T14:39:40.007Z
- Window End: 2026-06-07T14:51:32.469Z
- Duration: 11.9 min (712462 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 28
- Total Tokens: 2,598,070
- Cache Hit %: 99.3%
- Total USD: $1.0066
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 32
- cache_create_5m: 0
- cache_create_1h: 18,474
- cache_read: 2,571,280
- output: 8,284

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 28 msgs (100%), $1.0066 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 3

## Tool Usage

- Bash: 8
- Read: 4
- Agent: 3
- Edit: 3

## Tool Result Sizes (bytes)

- count: 18
- sum: 16,695
- p50: 996
- p90: 2,168
- max: 2,390

## File Re-reads

- redundant_read_count: 2
- top paths:
  - 3× C:\work\mega\hero-crew\scripts\lib\fleet.ts

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Agent: 3 calls, 6,624B results, ~8,802 cache_create tok (1.33×)
- Read: 4 calls, 6,199B results, ~4,462 cache_create tok (0.72×)
- Bash: 7 calls, 1,319B results, ~2,279 cache_create tok (1.73×)
- Edit: 3 calls, 447B results, ~2,084 cache_create tok (4.66×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 28
- usd: $1.0066
- input: 32
- cache_create_5m: 0
- cache_create_1h: 18,474
- cache_read: 2,571,280
- output: 8,284

