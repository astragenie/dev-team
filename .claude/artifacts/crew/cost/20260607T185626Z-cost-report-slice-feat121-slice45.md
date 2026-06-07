---
kind: cost-report
feature: FEAT-121
run_title: "FEAT121 SLICE45"
usd: 10.5385
duration_ms: 767440
total_tokens: 19232893
cache_hit_pct: 97.4
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T18:56:26.982Z
---

# Cost Report: FEAT121 SLICE45

- Created: 2026-06-07T18:56:26.982Z
- Run Title: FEAT121 SLICE45
- Window Start: 2026-06-07T18:43:39.166Z
- Window End: 2026-06-07T18:56:26.606Z
- Duration: 12.8 min (767440 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 148
- Total Tokens: 19,232,893
- Cache Hit %: 97.4%
- Total USD: $10.5385
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 154
- cache_create_5m: 0
- cache_create_1h: 492,779
- cache_read: 18,606,672
- output: 133,288

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 148 msgs (100%), $10.5385 (100%)

## Conversation Shape

- user_msg_count: 1
- user_msg_avg_len: 14989
- turns_before_first_tool: 1
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 0

## Tool Usage

- Edit: 43
- Bash: 31
- Read: 29

## Tool Result Sizes (bytes)

- count: 105
- sum: 146,122
- p50: 165
- p90: 4,156
- max: 15,738

## File Re-reads

- redundant_read_count: 11
- top paths:
  - 4× C:\work\mega\hero-crew\tests\regression.test.ts
  - 3× C:\work\mega\hero-crew\tests\subagent-return.test.ts
  - 3× C:\work\mega\hero-crew\tests\ux-validation.test.ts
  - 2× C:\work\mega\hero-crew\tests\preflight-shell.test.ts
  - 2× C:\work\mega\hero-crew\tests\journey-builder.test.ts

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Read: 30 calls, 89,738B results, ~347,855 cache_create tok (3.88×)
- Edit: 43 calls, 6,765B results, ~88,661 cache_create tok (13.11×)
- Bash: 31 calls, 49,100B results, ~55,685 cache_create tok (1.13×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 148
- usd: $10.5385
- input: 154
- cache_create_5m: 0
- cache_create_1h: 492,779
- cache_read: 18,606,672
- output: 133,288

