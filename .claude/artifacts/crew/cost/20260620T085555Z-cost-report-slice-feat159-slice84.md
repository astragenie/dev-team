---
kind: cost-report
feature: FEAT-159
run_title: "FEAT159 SLICE84"
usd: 35.4666
duration_ms: 1869574
total_tokens: 20199505
cache_hit_pct: 99.6
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-20T08:55:55.383Z
---

# Cost Report: FEAT159 SLICE84

- Created: 2026-06-20T08:55:55.383Z
- Run Title: FEAT159 SLICE84
- Window Start: 2026-06-20T08:24:44.706Z
- Window End: 2026-06-20T08:55:54.280Z
- Duration: 31.2 min (1869574 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 78
- Total Tokens: 20,199,505
- Cache Hit %: 99.6%
- Total USD: $35.4666
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 139
- cache_create_5m: 0
- cache_create_1h: 88,623
- cache_read: 20,074,828
- output: 35,915

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 78 msgs (100%), $35.4666 (100%)

## Conversation Shape

- user_msg_count: 3
- user_msg_avg_len: 3038
- turns_before_first_tool: 1
- compaction_count: 2
- skill_invocations: 0
- subagent_dispatches: 4

## Tool Usage

- Bash: 19 (2 failed)
- TaskUpdate: 7
- Read: 5
- TaskCreate: 4
- Agent: 4
- Edit: 4

## Tool Result Sizes (bytes)

- count: 44
- sum: 47,007
- p50: 166
- p90: 1,841
- max: 15,688

## File Re-reads

- redundant_read_count: 2
- top paths:
  - 2× C:\work\mega\hero-crew\scripts\lib\agent-stats-aggregator.ts
  - 2× C:\work\mega\hero-crew\tests\agent-stats-aggregator.test.ts

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 19 calls, 9,483B results, ~32,304 cache_create tok (3.41×)
- Read: 5 calls, 17,681B results, ~20,023 cache_create tok (1.13×)
- Agent: 4 calls, 3,083B results, ~14,842 cache_create tok (4.81×)
- Edit: 4 calls, 663B results, ~3,425 cache_create tok (5.17×)
- TaskUpdate: 7 calls, 161B results, ~1,652 cache_create tok (10.26×)
- TaskCreate: 4 calls, 248B results, ~1,345 cache_create tok (5.42×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 78
- usd: $35.4666
- input: 139
- cache_create_5m: 0
- cache_create_1h: 88,623
- cache_read: 20,074,828
- output: 35,915

