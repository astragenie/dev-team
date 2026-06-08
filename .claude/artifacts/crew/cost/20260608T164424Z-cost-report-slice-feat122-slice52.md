---
kind: cost-report
feature: FEAT-122
run_title: "FEAT122 SLICE52"
usd: 1.5992
duration_ms: 480479
total_tokens: 3958230
cache_hit_pct: 99.4
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-08T16:44:24.383Z
---

# Cost Report: FEAT122 SLICE52

- Created: 2026-06-08T16:44:24.383Z
- Run Title: FEAT122 SLICE52
- Window Start: 2026-06-08T16:36:23.539Z
- Window End: 2026-06-08T16:44:24.018Z
- Duration: 8.0 min (480479 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 29
- Total Tokens: 3,958,230
- Cache Hit %: 99.4%
- Total USD: $1.5992
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 35
- cache_create_5m: 0
- cache_create_1h: 24,911
- cache_read: 3,914,942
- output: 18,342

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 29 msgs (100%), $1.5992 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 2

## Tool Usage

- Bash: 12
- Read: 2
- Agent: 2
- Edit: 1

## Tool Result Sizes (bytes)

- count: 18
- sum: 13,202
- p50: 218
- p90: 1,590
- max: 5,094

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Agent: 2 calls, 2,144B results, ~13,269 cache_create tok (6.19×)
- Bash: 12 calls, 4,125B results, ~7,899 cache_create tok (1.91×)
- Read: 2 calls, 6,658B results, ~3,094 cache_create tok (0.46×)
- Edit: 1 calls, 151B results, ~276 cache_create tok (1.83×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 29
- usd: $1.5992
- input: 35
- cache_create_5m: 0
- cache_create_1h: 24,911
- cache_read: 3,914,942
- output: 18,342

