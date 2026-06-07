---
kind: cost-report
feature: FEAT-116
run_title: "FEAT116 SLICE40"
usd: 2.6643
duration_ms: 1485632
total_tokens: 4916882
cache_hit_pct: 97
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T14:37:27.970Z
---

# Cost Report: FEAT116 SLICE40

- Created: 2026-06-07T14:37:27.970Z
- Run Title: FEAT116 SLICE40
- Window Start: 2026-06-07T14:12:30.486Z
- Window End: 2026-06-07T14:37:16.118Z
- Duration: 24.8 min (1485632 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 36
- Total Tokens: 4,916,882
- Cache Hit %: 97%
- Total USD: $2.6643
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 48
- cache_create_5m: 0
- cache_create_1h: 148,039
- cache_read: 4,745,308
- output: 23,487

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 36 msgs (100%), $2.6643 (100%)

## Conversation Shape

- user_msg_count: 1
- user_msg_avg_len: 12648
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 3

## Tool Usage

- Bash: 18 (1 failed)
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
- Bash: 17 calls, 14,313B results, ~13,096 cache_create tok (0.91×)
- Read: 2 calls, 8,704B results, ~9,943 cache_create tok (1.14×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 36
- usd: $2.6643
- input: 48
- cache_create_5m: 0
- cache_create_1h: 148,039
- cache_read: 4,745,308
- output: 23,487

