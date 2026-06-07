---
kind: cost-report
feature: FEAT-104
run_title: "FEAT104 SLICE22"
usd: 1.3233
duration_ms: 142116
total_tokens: 3795534
cache_hit_pct: 99.7
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T10:23:41.642Z
---

# Cost Report: FEAT104 SLICE22

- Created: 2026-06-07T10:23:41.642Z
- Run Title: FEAT104 SLICE22
- Window Start: 2026-06-07T10:21:19.211Z
- Window End: 2026-06-07T10:23:41.327Z
- Duration: 2.4 min (142116 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 25
- Total Tokens: 3,795,534
- Cache Hit %: 99.7%
- Total USD: $1.3233
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 25
- cache_create_5m: 0
- cache_create_1h: 12,160
- cache_read: 3,775,511
- output: 7,838

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 25 msgs (100%), $1.3233 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 0

## Tool Usage

- Bash: 10
- Read: 4
- Write: 2
- Edit: 2

## Tool Result Sizes (bytes)

- count: 19
- sum: 9,897
- p50: 237
- p90: 1,284
- max: 2,427

## File Re-reads

- redundant_read_count: 2
- top paths:
  - 2× C:\work\mega\hero-crew\scripts\lib\session-cost-scanner.mjs
  - 2× C:\work\mega\hero-crew\scripts\lib\session-cost.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 10 calls, 2,788B results, ~3,342 cache_create tok (1.2×)
- Write: 2 calls, 287B results, ~3,303 cache_create tok (11.51×)
- Read: 4 calls, 4,081B results, ~2,922 cache_create tok (0.72×)
- Edit: 2 calls, 314B results, ~1,478 cache_create tok (4.71×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 25
- usd: $1.3233
- input: 25
- cache_create_5m: 0
- cache_create_1h: 12,160
- cache_read: 3,775,511
- output: 7,838

