---
kind: cost-report
feature: FEAT-162
run_title: "FEAT162 SLICE80"
usd: 76.1837
duration_ms: 1560967
total_tokens: 43350700
cache_hit_pct: 99.6
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-19T18:04:10.282Z
---

# Cost Report: FEAT162 SLICE80

- Created: 2026-06-19T18:04:10.282Z
- Run Title: FEAT162 SLICE80
- Window Start: 2026-06-13T19:31:15.078Z
- Window End: 2026-06-13T19:57:16.045Z
- Duration: 26.0 min (1560967 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 93
- Total Tokens: 43,350,700
- Cache Hit %: 99.6%
- Total USD: $76.1837
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 170
- cache_create_5m: 0
- cache_create_1h: 160,769
- cache_read: 43,100,326
- output: 89,435

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 93 msgs (100%), $76.1837 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 1
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 5

## Tool Usage

- Bash: 26 (2 failed)
- Edit: 15
- Read: 9
- Agent: 5
- Glob: 3

## Tool Result Sizes (bytes)

- count: 58
- sum: 52,500
- p50: 449
- p90: 1,750
- max: 10,039

## File Re-reads

- redundant_read_count: 7
- top paths:
  - 6× C:\work\mega\hero-crew\scripts\render-universal-skills.ts
  - 3× C:\work\mega\hero-crew\scripts\validate-agents.ts

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 26 calls, 27,244B results, ~91,937 cache_create tok (3.37×)
- Agent: 4 calls, 13,124B results, ~41,112 cache_create tok (3.13×)
- Edit: 15 calls, 2,405B results, ~12,439 cache_create tok (5.17×)
- Read: 9 calls, 9,423B results, ~11,031 cache_create tok (1.17×)
- Glob: 3 calls, 42B results, ~3,154 cache_create tok (75.1×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 93
- usd: $76.1837
- input: 170
- cache_create_5m: 0
- cache_create_1h: 160,769
- cache_read: 43,100,326
- output: 89,435

