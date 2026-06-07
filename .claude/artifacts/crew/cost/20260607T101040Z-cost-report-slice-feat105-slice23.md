---
kind: cost-report
feature: FEAT-105
run_title: "FEAT105 SLICE23"
usd: 0.0347
duration_ms: 12804
total_tokens: 100530
cache_hit_pct: 99.7
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T10:10:40.106Z
---

# Cost Report: FEAT105 SLICE23

- Created: 2026-06-07T10:10:40.106Z
- Run Title: FEAT105 SLICE23
- Window Start: 2026-06-07T10:10:26.987Z
- Window End: 2026-06-07T10:10:39.791Z
- Duration: 0.2 min (12804 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 1
- Total Tokens: 100,530
- Cache Hit %: 99.7%
- Total USD: $0.0347
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 1
- cache_create_5m: 0
- cache_create_1h: 270
- cache_read: 100,055
- output: 204

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 1 msgs (100%), $0.0347 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 0

## Tool Usage

- Bash: 1

## Tool Result Sizes (bytes)

- count: 2
- sum: 381
- p50: 279
- p90: 279
- max: 279

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 1 calls, 102B results, ~0 cache_create tok (0×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 1
- usd: $0.0347
- input: 1
- cache_create_5m: 0
- cache_create_1h: 270
- cache_read: 100,055
- output: 204

