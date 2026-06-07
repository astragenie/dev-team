---
kind: cost-report
feature: FEAT-101
run_title: "FEAT101 SLICE19"
usd: 1.5754
duration_ms: 174320
total_tokens: 4374078
cache_hit_pct: 99.6
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T10:14:22.737Z
---

# Cost Report: FEAT101 SLICE19

- Created: 2026-06-07T10:14:22.737Z
- Run Title: FEAT101 SLICE19
- Window Start: 2026-06-07T10:11:28.098Z
- Window End: 2026-06-07T10:14:22.418Z
- Duration: 2.9 min (174320 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 39
- Total Tokens: 4,374,078
- Cache Hit %: 99.6%
- Total USD: $1.5754
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 39
- cache_create_5m: 0
- cache_create_1h: 16,741
- cache_read: 4,345,896
- output: 11,402

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 39 msgs (100%), $1.5754 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 0

## Tool Usage

- Bash: 13
- Edit: 6
- Read: 5
- Write: 2

## Tool Result Sizes (bytes)

- count: 27
- sum: 10,904
- p50: 182
- p90: 1,192
- max: 3,041

## File Re-reads

- redundant_read_count: 2
- top paths:
  - 2× C:\work\mega\hero-crew\scripts\lib\briefing\collect.mjs
  - 2× C:\work\mega\hero-crew\scripts\lib\wakeup.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Read: 5 calls, 6,761B results, ~5,136 cache_create tok (0.76×)
- Edit: 6 calls, 957B results, ~4,659 cache_create tok (4.87×)
- Bash: 13 calls, 2,779B results, ~4,158 cache_create tok (1.5×)
- Write: 2 calls, 279B results, ~2,554 cache_create tok (9.15×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 39
- usd: $1.5754
- input: 39
- cache_create_5m: 0
- cache_create_1h: 16,741
- cache_read: 4,345,896
- output: 11,402

