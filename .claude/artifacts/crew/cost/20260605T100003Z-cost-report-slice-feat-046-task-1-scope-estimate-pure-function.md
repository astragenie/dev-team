---
kind: cost-report
run_title: "FEAT-046 Task 1 scope-estimate pure function"
usd: 2.4021
duration_ms: 280898
total_tokens: 5479723
cache_hit_pct: 98.8
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-05T10:00:03.926Z
---

# Cost Report: FEAT-046 Task 1 scope-estimate pure function

- Created: 2026-06-05T10:00:03.926Z
- Run Title: FEAT-046 Task 1 scope-estimate pure function
- Window Start: 2026-06-05T09:55:22.780Z
- Window End: 2026-06-05T10:00:03.678Z
- Duration: 4.7 min (280898 ms)
- Sessions Scanned: 2
- Assistant Messages Counted: 51
- Total Tokens: 5,479,723
- Cache Hit %: 98.8%
- Total USD: $2.4021
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 59
- cache_create_5m: 0
- cache_create_1h: 63,504
- cache_read: 5,389,215
- output: 26,945

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 51 msgs (100%), $2.4021 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 2
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 1

## Tool Usage

- Bash: 16 (3 failed)
- Read: 8
- Grep: 3
- Write: 2
- Agent: 1

## Tool Result Sizes (bytes)

- count: 32
- sum: 34,983
- p50: 326
- p90: 3,765
- max: 4,265

## File Re-reads

- redundant_read_count: 3
- top paths:
  - 3× C:\work\mega\hero-crew\scripts\crew.mjs
  - 2× C:\work\mega\hero-crew\scripts\lib\artifacts.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Read: 8 calls, 23,219B results, ~25,461 cache_create tok (1.1×)
- Bash: 16 calls, 4,408B results, ~16,137 cache_create tok (3.66×)
- Grep: 3 calls, 2,887B results, ~8,562 cache_create tok (2.97×)
- Agent: 1 calls, 3,615B results, ~5,340 cache_create tok (1.48×)
- Write: 2 calls, 297B results, ~1,698 cache_create tok (5.72×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 51
- usd: $2.4021
- input: 59
- cache_create_5m: 0
- cache_create_1h: 63,504
- cache_read: 5,389,215
- output: 26,945

