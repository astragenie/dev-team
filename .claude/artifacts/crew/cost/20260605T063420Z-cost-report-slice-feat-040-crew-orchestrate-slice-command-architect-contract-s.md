---
kind: cost-report
run_title: "FEAT-040: /crew:orchestrate-slice command + architect contract schema"
usd: 11.0096
duration_ms: 2386052
total_tokens: 23379161
cache_hit_pct: 97.9
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-05T06:34:20.035Z
---

# Cost Report: FEAT-040: /crew:orchestrate-slice command + architect contract schema

- Created: 2026-06-05T06:34:20.035Z
- Run Title: FEAT-040: /crew:orchestrate-slice command + architect contract schema
- Window Start: 2026-06-05T05:54:33.764Z
- Window End: 2026-06-05T06:34:19.816Z
- Duration: 39.8 min (2386052 ms)
- Sessions Scanned: 2
- Assistant Messages Counted: 213
- Total Tokens: 23,379,161
- Cache Hit %: 97.9%
- Total USD: $11.0096
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 310
- cache_create_5m: 0
- cache_create_1h: 477,749
- cache_read: 22,814,581
- output: 86,521

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 213 msgs (100%), $11.0096 (100%)

## Conversation Shape

- user_msg_count: 21
- user_msg_avg_len: 642
- turns_before_first_tool: 1
- compaction_count: 8
- skill_invocations: 2
- subagent_dispatches: 4

## Tool Usage

- Bash: 64 (3 failed)
- Read: 15
- Edit: 8
- Agent: 4
- Write: 3
- Skill: 2
- PowerShell: 2
- AskUserQuestion: 1

## Tool Result Sizes (bytes)

- count: 100
- sum: 167,625
- p50: 336
- p90: 4,873
- max: 22,194

## File Re-reads

- redundant_read_count: 5
- top paths:
  - 4× C:\Users\serge\.claude\projects\C--work-mega-hero-crew\417861b7-d16e-4d4e-b61d-b31314f1e7d5\tool-results\bup22qzst.txt
  - 3× C:\work\mega\hero-crew\commands\orchestrate-slice.md

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 64 calls, 81,538B results, ~301,444 cache_create tok (3.7×)
- Read: 15 calls, 75,059B results, ~51,776 cache_create tok (0.69×)
- Agent: 4 calls, 8,774B results, ~26,060 cache_create tok (2.97×)
- Skill: 2 calls, 72B results, ~9,263 cache_create tok (128.65×)
- Write: 3 calls, 473B results, ~8,849 cache_create tok (18.71×)
- Edit: 8 calls, 1,246B results, ~3,967 cache_create tok (3.18×)
- AskUserQuestion: 1 calls, 158B results, ~601 cache_create tok (3.8×)
- PowerShell: 2 calls, 18B results, ~471 cache_create tok (26.17×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 213
- usd: $11.0096
- input: 310
- cache_create_5m: 0
- cache_create_1h: 477,749
- cache_read: 22,814,581
- output: 86,521

