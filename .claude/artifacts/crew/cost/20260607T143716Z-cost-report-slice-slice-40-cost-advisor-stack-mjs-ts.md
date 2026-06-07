---
kind: cost-report
slice: SLICE-40
run_title: "SLICE-40: cost-advisor stack .mjs → .ts"
usd: 2.6342
duration_ms: 1485632
total_tokens: 4846259
cache_hit_pct: 96.9
review_decision: approved
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T14:37:16.732Z
---

# Cost Report: SLICE-40: cost-advisor stack .mjs → .ts

- Created: 2026-06-07T14:37:16.732Z
- Run Title: SLICE-40: cost-advisor stack .mjs → .ts
- Window Start: 2026-06-07T14:12:30.486Z
- Window End: 2026-06-07T14:37:16.118Z
- Duration: 24.8 min (1485632 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 35
- Total Tokens: 4,846,259
- Cache Hit %: 96.9%
- Total USD: $2.6342
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Outcome Linkage

- Slice: SLICE-40
- Grade Avg: -
- Review Decision: approved
- Validation Decision: -

## Tokens (totals)

- input: 47
- cache_create_5m: 0
- cache_create_1h: 147,303
- cache_read: 4,675,744
- output: 23,165

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 35 msgs (100%), $2.6342 (100%)

## Conversation Shape

- user_msg_count: 1
- user_msg_avg_len: 12648
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 3

## Tool Usage

- Bash: 17 (1 failed)
- Agent: 3
- Read: 2

## Tool Result Sizes (bytes)

- count: 23
- sum: 28,430
- p50: 676
- p90: 2,048
- max: 8,573

## File Re-reads

- redundant_read_count: 1
- top paths:
  - 2× C:\work\mega\hero-crew\scripts\lib\session-cost.ts

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Agent: 3 calls, 5,299B results, ~124,786 cache_create tok (23.55×)
- Bash: 17 calls, 14,313B results, ~12,360 cache_create tok (0.86×)
- Read: 2 calls, 8,704B results, ~9,943 cache_create tok (1.14×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 35
- usd: $2.6342
- input: 47
- cache_create_5m: 0
- cache_create_1h: 147,303
- cache_read: 4,675,744
- output: 23,165

