---
kind: cost-report
slice: SLICE-01
run_title: "SLICE-01"
usd: 1.8352
duration_ms: 16605
total_tokens: 782985
cache_hit_pct: 98.1
review_decision: pass
source_project: aggregate
aggregate_all: true
source_count: 1
created_at: 2026-05-23T22:14:12.358Z
---

# Cost Report: Cost — SLICE-01

- Created: 2026-05-23T22:14:12.358Z
- Run Title: SLICE-01
- Window Start: 2026-05-23T19:33:37.541Z
- Window End: 2026-05-23T19:33:54.146Z
- Duration: 0.3 min (16605 ms)
- Sessions Scanned: 2
- Assistant Messages Counted: 4
- Total Tokens: 782,985
- Cache Hit %: 98.1%
- Total USD: $1.8352
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Outcome Linkage

- Slice: SLICE-01
- Grade Avg: -
- Review Decision: pass
- Validation Decision: -

## Tokens (totals)

- input: 9
- cache_create_5m: 0
- cache_create_1h: 14,673
- cache_read: 765,005
- output: 3,298

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 4 msgs (100%), $1.8352 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 1
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 0

## Tool Usage

- Bash: 3

## Tool Result Sizes (bytes)

- count: 3
- sum: 351
- p50: 49
- p90: 253
- max: 253

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 2 calls, 98B results, ~1,419 cache_create tok (14.48×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 4
- usd: $1.8352
- input: 9
- cache_create_5m: 0
- cache_create_1h: 14,673
- cache_read: 765,005
- output: 3,298

