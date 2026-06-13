---
kind: cost-report
run_title: "Pre-merge security sweep — secrets scan + supply-chain audit routing"
usd: 189.6328
duration_ms: 2002273
total_tokens: 117564324
cache_hit_pct: 99.7
source_project: aggregate
aggregate_all: true
source_count: 5
created_at: 2026-06-13T17:12:25.462Z
---

# Cost Report: Pre-merge security sweep — secrets scan + supply-chain audit routing

- Created: 2026-06-13T17:12:25.462Z
- Run Title: Pre-merge security sweep — secrets scan + supply-chain audit routing
- Window Start: 2026-06-13T16:38:53.933Z
- Window End: 2026-06-13T17:12:16.206Z
- Duration: 33.4 min (2002273 ms)
- Sessions Scanned: 5
- Assistant Messages Counted: 301
- Total Tokens: 117,564,324
- Cache Hit %: 99.7%
- Total USD: $189.6328
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-cortex: 81 msgs, $87.4166
- C--work-mega-loopobserver: 45 msgs, $58.9275
- C--work-mega-common: 70 msgs, $21.6701
- C--work-mega-hero-crew: 32 msgs, $18.1231
- C--work-mega-loop: 73 msgs, $3.4955

## Tokens (totals)

- input: 8,294
- cache_create_5m: 0
- cache_create_1h: 392,240
- cache_read: 116,946,409
- output: 217,381

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 228 msgs (75.75%), $186.1373 (98.16%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 73 msgs (24.25%), $3.4955 (1.84%)

## Conversation Shape

- user_msg_count: 26
- user_msg_avg_len: 513
- turns_before_first_tool: 0
- compaction_count: 1
- skill_invocations: 0
- subagent_dispatches: 14

## Tool Usage

- Bash: 101 (5 failed)
- Agent: 14
- Read: 12
- Edit: 10 (2 failed)
- Write: 6
- AskUserQuestion: 5 (3 failed)
- ToolSearch: 2
- TaskStop: 2
- ScheduleWakeup: 1

## Tool Result Sizes (bytes)

- count: 156
- sum: 142,018
- p50: 292
- p90: 982
- max: 29,208

## File Re-reads

- redundant_read_count: 1
- top paths:
  - 2× C:\work\mega\.-FEAT-197-0\src\scripts\dispatch.mts

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 100 calls, 62,527B results, ~202,797 cache_create tok (3.24×)
- Agent: 13 calls, 18,207B results, ~88,431 cache_create tok (4.86×)
- Read: 12 calls, 29,424B results, ~48,391 cache_create tok (1.64×)
- Write: 6 calls, 1,101B results, ~25,412 cache_create tok (23.08×)
- AskUserQuestion: 5 calls, 2,678B results, ~11,203 cache_create tok (4.18×)
- Edit: 10 calls, 1,712B results, ~9,537 cache_create tok (5.57×)
- ToolSearch: 2 calls, 99B results, ~4,111 cache_create tok (41.53×)
- TaskStop: 2 calls, 840B results, ~1,102 cache_create tok (1.31×)
- ScheduleWakeup: 1 calls, 158B results, ~838 cache_create tok (5.3×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 228
- usd: $186.1373
- input: 8,181
- cache_create_5m: 0
- cache_create_1h: 338,006
- cache_read: 108,032,983
- output: 184,332

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 73
- usd: $3.4955
- input: 113
- cache_create_5m: 0
- cache_create_1h: 54,234
- cache_read: 8,913,426
- output: 33,049

