---
kind: cost-report
feature: FEAT-196
run_title: "FEAT196 SLICE110"
usd: 3.0373
duration_ms: 707500
total_tokens: 1050375
cache_hit_pct: 97.6
source_project: C--work-mega-dev-team
aggregate_all: false
source_count: 1
created_at: 2026-07-08T08:14:09.733Z
---

# Cost Report: FEAT196 SLICE110

- Created: 2026-07-08T08:14:09.733Z
- Run Title: FEAT196 SLICE110
- Window Start: 2026-07-08T08:02:21.657Z
- Window End: 2026-07-08T08:14:09.157Z
- Duration: 11.8 min (707500 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 6
- Total Tokens: 1,050,375
- Cache Hit %: 97.6%
- Total USD: $3.0373
- Source Project: C--work-mega-dev-team
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 12
- cache_create_5m: 0
- cache_create_1h: 24,846
- cache_read: 1,015,266
- output: 10,251

## Model Mix

- claude-opus-4-8 (priced as claude-opus-4): 6 msgs (100%), $3.0373 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 2
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 2

## Tool Usage

- Agent: 2

## Tool Result Sizes (bytes)

- count: 3
- sum: 16,291
- p50: 3,175
- p90: 10,733
- max: 10,733

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Agent: 2 calls, 5,558B results, ~10,536 cache_create tok (1.9×)


## By Model (token detail)

### claude-opus-4-8 (priced as claude-opus-4)
- messages: 6
- usd: $3.0373
- input: 12
- cache_create_5m: 0
- cache_create_1h: 24,846
- cache_read: 1,015,266
- output: 10,251

