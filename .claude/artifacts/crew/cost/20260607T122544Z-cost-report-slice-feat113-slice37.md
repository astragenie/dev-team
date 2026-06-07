---
kind: cost-report
feature: FEAT-113
run_title: "FEAT113 SLICE37"
usd: 1.9962
duration_ms: 1437870
total_tokens: 4947801
cache_hit_pct: 99.2
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T12:25:44.519Z
---

# Cost Report: FEAT113 SLICE37

- Created: 2026-06-07T12:25:44.519Z
- Run Title: FEAT113 SLICE37
- Window Start: 2026-06-07T12:01:46.298Z
- Window End: 2026-06-07T12:25:44.168Z
- Duration: 24.0 min (1437870 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 37
- Total Tokens: 4,947,801
- Cache Hit %: 99.2%
- Total USD: $1.9962
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 53
- cache_create_5m: 0
- cache_create_1h: 39,585
- cache_read: 4,888,700
- output: 19,463

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 37 msgs (100%), $1.9962 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 5

## Tool Usage

- Bash: 13
- Agent: 5
- Read: 2
- Edit: 2

## Tool Result Sizes (bytes)

- count: 23
- sum: 21,167
- p50: 206
- p90: 2,492
- max: 6,843

## File Re-reads

- redundant_read_count: 1
- top paths:
  - 2× C:\work\mega\hero-crew\scripts\lib\installer\global.ts

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Agent: 5 calls, 8,435B results, ~22,930 cache_create tok (2.72×)
- Read: 2 calls, 8,247B results, ~8,961 cache_create tok (1.09×)
- Bash: 13 calls, 4,076B results, ~5,724 cache_create tok (1.4×)
- Edit: 2 calls, 320B results, ~1,758 cache_create tok (5.49×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 37
- usd: $1.9962
- input: 53
- cache_create_5m: 0
- cache_create_1h: 39,585
- cache_read: 4,888,700
- output: 19,463

