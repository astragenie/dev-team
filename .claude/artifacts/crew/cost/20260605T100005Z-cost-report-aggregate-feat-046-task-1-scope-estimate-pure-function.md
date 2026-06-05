---
kind: cost-report
run_title: "FEAT-046 Task 1 scope-estimate pure function"
usd: 2.5339
duration_ms: 280898
total_tokens: 5743729
cache_hit_pct: 98.8
source_project: aggregate
aggregate_all: true
source_count: 2
created_at: 2026-06-05T10:00:05.919Z
---

# Cost Report: FEAT-046 Task 1 scope-estimate pure function

- Created: 2026-06-05T10:00:05.919Z
- Run Title: FEAT-046 Task 1 scope-estimate pure function
- Window Start: 2026-06-05T09:55:22.780Z
- Window End: 2026-06-05T10:00:03.678Z
- Duration: 4.7 min (280898 ms)
- Sessions Scanned: 3
- Assistant Messages Counted: 55
- Total Tokens: 5,743,729
- Cache Hit %: 98.8%
- Total USD: $2.5339
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-hero-crew: 51 msgs, $2.4021
- C--work-mega-loopobserver: 4 msgs, $0.1317

## Tokens (totals)

- input: 69
- cache_create_5m: 0
- cache_create_1h: 70,728
- cache_read: 5,645,217
- output: 27,715

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 55 msgs (100%), $2.5339 (100%)

## Conversation Shape

- user_msg_count: 1
- user_msg_avg_len: 2513
- turns_before_first_tool: 2
- compaction_count: 1
- skill_invocations: 0
- subagent_dispatches: 1

## Tool Usage

- Bash: 17 (3 failed)
- Read: 8
- Grep: 3
- Write: 2
- Agent: 1

## Tool Result Sizes (bytes)

- count: 33
- sum: 35,364
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
- Bash: 17 calls, 4,789B results, ~23,361 cache_create tok (4.88×)
- Grep: 3 calls, 2,887B results, ~8,562 cache_create tok (2.97×)
- Agent: 1 calls, 3,615B results, ~5,340 cache_create tok (1.48×)
- Write: 2 calls, 297B results, ~1,698 cache_create tok (5.72×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 55
- usd: $2.5339
- input: 69
- cache_create_5m: 0
- cache_create_1h: 70,728
- cache_read: 5,645,217
- output: 27,715

