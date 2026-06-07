---
kind: cost-report
feature: FEAT-120
run_title: "FEAT120 SLICE44"
usd: 13.9636
duration_ms: 1862145
total_tokens: 27846122
cache_hit_pct: 97.9
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T16:50:36.286Z
---

# Cost Report: FEAT120 SLICE44

- Created: 2026-06-07T16:50:36.286Z
- Run Title: FEAT120 SLICE44
- Window Start: 2026-06-07T16:19:33.801Z
- Window End: 2026-06-07T16:50:35.946Z
- Duration: 31.0 min (1862145 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 222
- Total Tokens: 27,846,122
- Cache Hit %: 97.9%
- Total USD: $13.9636
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 2,359
- cache_create_5m: 0
- cache_create_1h: 586,948
- cache_read: 27,103,227
- output: 153,588

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 222 msgs (100%), $13.9636 (100%)

## Conversation Shape

- user_msg_count: 2
- user_msg_avg_len: 6474
- turns_before_first_tool: 2
- compaction_count: 3
- skill_invocations: 0
- subagent_dispatches: 5

## Tool Usage

- Read: 59
- Bash: 36
- PowerShell: 18 (8 failed)
- Edit: 13
- Agent: 5
- Write: 3
- Grep: 1

## Tool Result Sizes (bytes)

- count: 138
- sum: 147,961
- p50: 515
- p90: 2,037
- max: 15,410

## File Re-reads

- redundant_read_count: 43
- top paths:
  - 14× C:\work\mega\hero-crew\tests\cost-report-role-breakdown.test.ts
  - 9× C:\work\mega\hero-crew\tests\briefing-cost-rollup-dedupe.test.ts
  - 7× C:\work\mega\hero-crew\tests\cost-report-emission.test.ts
  - 6× C:\work\mega\hero-crew\tests\briefing-cost-health.test.ts
  - 6× C:\work\mega\hero-crew\tests\cli.test.ts

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Read: 60 calls, 65,453B results, ~261,057 cache_create tok (3.99×)
- Bash: 36 calls, 46,430B results, ~254,152 cache_create tok (5.47×)
- PowerShell: 19 calls, 28,455B results, ~32,195 cache_create tok (1.13×)
- Agent: 5 calls, 3,622B results, ~22,910 cache_create tok (6.33×)
- Edit: 13 calls, 2,155B results, ~8,782 cache_create tok (4.08×)
- Write: 3 calls, 444B results, ~5,041 cache_create tok (11.35×)
- Grep: 1 calls, 1,261B results, ~1,857 cache_create tok (1.47×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 222
- usd: $13.9636
- input: 2,359
- cache_create_5m: 0
- cache_create_1h: 586,948
- cache_read: 27,103,227
- output: 153,588

