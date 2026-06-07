---
kind: cost-report
feature: FEAT-115
run_title: "FEAT115 SLICE39"
usd: 6.5604
duration_ms: 2122629
total_tokens: 16924508
cache_hit_pct: 99.3
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T14:11:07.691Z
---

# Cost Report: FEAT115 SLICE39

- Created: 2026-06-07T14:11:07.691Z
- Run Title: FEAT115 SLICE39
- Window Start: 2026-06-07T13:35:44.683Z
- Window End: 2026-06-07T14:11:07.312Z
- Duration: 35.4 min (2122629 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 160
- Total Tokens: 16,924,508
- Cache Hit %: 99.3%
- Total USD: $6.5604
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 172
- cache_create_5m: 0
- cache_create_1h: 114,513
- cache_read: 16,753,370
- output: 56,453

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 160 msgs (100%), $6.5604 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 2
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 3

## Tool Usage

- Bash: 45 (1 failed)
- Read: 34
- Edit: 25
- Agent: 3

## Tool Result Sizes (bytes)

- count: 108
- sum: 84,864
- p50: 435
- p90: 1,985
- max: 5,036

## File Re-reads

- redundant_read_count: 22
- top paths:
  - 11× C:\work\mega\hero-crew\scripts\crew.mjs
  - 6× C:\work\mega\hero-crew\scripts\lib\cost-hygiene\cost-slice-handler.ts
  - 5× C:\work\mega\hero-crew\scripts\lib\artifacts\write.ts
  - 2× C:\work\mega\hero-crew\scripts\lib\cost-hygiene\emit-cost-report.ts
  - 2× C:\work\mega\hero-crew\tests\cli.test.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Read: 34 calls, 51,264B results, ~45,406 cache_create tok (0.89×)
- Bash: 44 calls, 20,171B results, ~30,907 cache_create tok (1.53×)
- Edit: 25 calls, 3,876B results, ~18,442 cache_create tok (4.76×)
- Agent: 3 calls, 7,198B results, ~17,226 cache_create tok (2.39×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 160
- usd: $6.5604
- input: 172
- cache_create_5m: 0
- cache_create_1h: 114,513
- cache_read: 16,753,370
- output: 56,453

