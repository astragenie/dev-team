---
kind: cost-report
feature: FEAT-102
run_title: "FEAT102 SLICE20"
usd: 0.6765
duration_ms: 90230
total_tokens: 1879447
cache_hit_pct: 99.4
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T10:16:43.610Z
---

# Cost Report: FEAT102 SLICE20

- Created: 2026-06-07T10:16:43.610Z
- Run Title: FEAT102 SLICE20
- Window Start: 2026-06-07T10:15:13.060Z
- Window End: 2026-06-07T10:16:43.290Z
- Duration: 1.5 min (90230 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 15
- Total Tokens: 1,879,447
- Cache Hit %: 99.4%
- Total USD: $0.6765
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 15
- cache_create_5m: 0
- cache_create_1h: 11,064
- cache_read: 1,864,996
- output: 3,372

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 15 msgs (100%), $0.6765 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 0

## Tool Usage

- Read: 4
- Bash: 4
- Edit: 1

## Tool Result Sizes (bytes)

- count: 10
- sum: 11,795
- p50: 1,375
- p90: 2,801
- max: 2,801

## File Re-reads

- redundant_read_count: 3
- top paths:
  - 4× C:\work\mega\hero-crew\scripts\lib\briefing\collect.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Read: 4 calls, 8,627B results, ~8,138 cache_create tok (0.94×)
- Edit: 1 calls, 161B results, ~1,012 cache_create tok (6.29×)
- Bash: 4 calls, 610B results, ~800 cache_create tok (1.31×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 15
- usd: $0.6765
- input: 15
- cache_create_5m: 0
- cache_create_1h: 11,064
- cache_read: 1,864,996
- output: 3,372

