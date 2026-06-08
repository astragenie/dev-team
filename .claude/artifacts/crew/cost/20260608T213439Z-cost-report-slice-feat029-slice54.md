---
kind: cost-report
feature: FEAT-029
run_title: "FEAT029 SLICE54"
usd: 0.819
duration_ms: 610448
total_tokens: 2236687
cache_hit_pct: 99.6
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-08T21:34:39.506Z
---

# Cost Report: FEAT029 SLICE54

- Created: 2026-06-08T21:34:39.506Z
- Run Title: FEAT029 SLICE54
- Window Start: 2026-06-08T21:24:28.690Z
- Window End: 2026-06-08T21:34:39.138Z
- Duration: 10.2 min (610448 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 15
- Total Tokens: 2,236,687
- Cache Hit %: 99.6%
- Total USD: $0.8190
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 15
- cache_create_5m: 0
- cache_create_1h: 8,093
- cache_read: 2,221,653
- output: 6,926

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 15 msgs (100%), $0.8190 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 2
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 2

## Tool Usage

- Bash: 8
- Agent: 2

## Tool Result Sizes (bytes)

- count: 11
- sum: 8,592
- p50: 158
- p90: 2,198
- max: 2,999

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 8 calls, 2,727B results, ~3,973 cache_create tok (1.46×)
- Agent: 2 calls, 3,667B results, ~1,441 cache_create tok (0.39×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 15
- usd: $0.8190
- input: 15
- cache_create_5m: 0
- cache_create_1h: 8,093
- cache_read: 2,221,653
- output: 6,926

