---
kind: cost-report
feature: FEAT-037
run_title: "FEAT037 SLICE17"
usd: 1.928
duration_ms: 554179
total_tokens: 5288504
cache_hit_pct: 99.5
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T09:51:51.695Z
---

# Cost Report: FEAT037 SLICE17

- Created: 2026-06-07T09:51:51.695Z
- Run Title: FEAT037 SLICE17
- Window Start: 2026-06-07T09:42:37.138Z
- Window End: 2026-06-07T09:51:51.317Z
- Duration: 9.2 min (554179 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 37
- Total Tokens: 5,288,504
- Cache Hit %: 99.5%
- Total USD: $1.9280
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 37
- cache_create_5m: 0
- cache_create_1h: 24,019
- cache_read: 5,250,542
- output: 13,906

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 37 msgs (100%), $1.9280 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 1
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 2

## Tool Usage

- Bash: 17
- Read: 4
- Agent: 2
- Edit: 1

## Tool Result Sizes (bytes)

- count: 25
- sum: 16,582
- p50: 517
- p90: 1,404
- max: 3,605

## File Re-reads

- redundant_read_count: 2
- top paths:
  - 3× C:/work/mega/hero-crew/tests/crew-write-review-result.test.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Agent: 2 calls, 3,858B results, ~10,359 cache_create tok (2.69×)
- Bash: 17 calls, 8,238B results, ~9,504 cache_create tok (1.15×)
- Read: 4 calls, 4,092B results, ~2,420 cache_create tok (0.59×)
- Edit: 1 calls, 168B results, ~1,112 cache_create tok (6.62×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 37
- usd: $1.9280
- input: 37
- cache_create_5m: 0
- cache_create_1h: 24,019
- cache_read: 5,250,542
- output: 13,906

