---
kind: cost-report
feature: FEAT-105
run_title: "FEAT105 SLICE23"
usd: 0.0691
duration_ms: 16808
total_tokens: 201286
cache_hit_pct: 99.7
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T10:10:44.097Z
---

# Cost Report: FEAT105 SLICE23

- Created: 2026-06-07T10:10:44.097Z
- Run Title: FEAT105 SLICE23
- Window Start: 2026-06-07T10:10:26.987Z
- Window End: 2026-06-07T10:10:43.795Z
- Duration: 0.3 min (16808 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 2
- Total Tokens: 201,286
- Cache Hit %: 99.7%
- Total USD: $0.0691
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 2
- cache_create_5m: 0
- cache_create_1h: 511
- cache_read: 200,380
- output: 393

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 2 msgs (100%), $0.0691 (100.03%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 0

## Tool Usage

- Bash: 2 (1 failed)

## Tool Result Sizes (bytes)

- count: 3
- sum: 1,101
- p50: 279
- p90: 720
- max: 720

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 2 calls, 822B results, ~241 cache_create tok (0.29×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 2
- usd: $0.0691
- input: 2
- cache_create_5m: 0
- cache_create_1h: 511
- cache_read: 200,380
- output: 393

