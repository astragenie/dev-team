---
kind: cost-report
feature: FEAT-139
run_title: "FEAT139 SLICE75"
usd: 58.2307
duration_ms: 1435575
total_tokens: 31964057
cache_hit_pct: 99.5
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-13T19:20:45.706Z
---

# Cost Report: FEAT139 SLICE75

- Created: 2026-06-13T19:20:45.706Z
- Run Title: FEAT139 SLICE75
- Window Start: 2026-06-13T18:56:04.230Z
- Window End: 2026-06-13T19:19:59.805Z
- Duration: 23.9 min (1435575 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 85
- Total Tokens: 31,964,057
- Cache Hit %: 99.5%
- Total USD: $58.2307
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 105
- cache_create_5m: 0
- cache_create_1h: 147,264
- cache_read: 31,733,883
- output: 82,805

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 85 msgs (100%), $58.2307 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 1
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 5

## Tool Usage

- Bash: 26
- Edit: 12
- Read: 9
- Agent: 5
- Write: 1

## Tool Result Sizes (bytes)

- count: 53
- sum: 38,153
- p50: 334
- p90: 1,351
- max: 6,325

## File Re-reads

- redundant_read_count: 5
- top paths:
  - 3× C:\work\mega\hero-crew\tests\test-quality-integration.test.ts
  - 3× C:\work\mega\hero-crew\skills\workflow\test-quality\scripts\analyze.ts
  - 2× C:\work\mega\hero-crew\skills\workflow\test-quality\SKILL.md

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 26 calls, 17,384B results, ~74,547 cache_create tok (4.29×)
- Agent: 4 calls, 7,613B results, ~32,382 cache_create tok (4.25×)
- Read: 9 calls, 10,473B results, ~19,426 cache_create tok (1.85×)
- Edit: 12 calls, 2,151B results, ~17,840 cache_create tok (8.29×)
- Write: 1 calls, 198B results, ~801 cache_create tok (4.05×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 85
- usd: $58.2307
- input: 105
- cache_create_5m: 0
- cache_create_1h: 147,264
- cache_read: 31,733,883
- output: 82,805

