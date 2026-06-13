---
kind: cost-report
feature: FEAT-161
run_title: "FEAT161 SLICE70"
usd: 7.5122
duration_ms: 784002
total_tokens: 3540909
cache_hit_pct: 99.1
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-13T09:02:57.821Z
---

# Cost Report: FEAT161 SLICE70

- Created: 2026-06-13T09:02:57.821Z
- Run Title: FEAT161 SLICE70
- Window Start: 2026-06-13T08:49:53.277Z
- Window End: 2026-06-13T09:02:57.279Z
- Duration: 13.1 min (784002 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 20
- Total Tokens: 3,540,909
- Cache Hit %: 99.1%
- Total USD: $7.5122
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 35
- cache_create_5m: 0
- cache_create_1h: 32,986
- cache_read: 3,490,742
- output: 17,146

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 20 msgs (100%), $7.5122 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 2
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 2

## Tool Usage

- Bash: 7
- Agent: 2

## Tool Result Sizes (bytes)

- count: 10
- sum: 16,708
- p50: 519
- p90: 11,200
- max: 11,200

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Agent: 2 calls, 2,385B results, ~10,644 cache_create tok (4.46×)
- Bash: 7 calls, 3,123B results, ~7,393 cache_create tok (2.37×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 20
- usd: $7.5122
- input: 35
- cache_create_5m: 0
- cache_create_1h: 32,986
- cache_read: 3,490,742
- output: 17,146

