---
kind: cost-report
feature: FEAT-131
run_title: "FEAT131 SLICE59"
usd: 76.7726
duration_ms: 730729
total_tokens: 49546263
cache_hit_pct: 99.9
source_project: C--work-mega
auto_detected: true
aggregate_all: false
source_count: 1
created_at: 2026-06-09T14:38:12.696Z
---

# Cost Report: FEAT131 SLICE59

- Created: 2026-06-09T14:38:12.696Z
- Run Title: FEAT131 SLICE59
- Window Start: 2026-05-22T06:41:58.357Z
- Window End: 2026-05-22T06:54:09.086Z
- Duration: 12.2 min (730729 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 56
- Total Tokens: 49,546,263
- Cache Hit %: 99.9%
- Total USD: $76.7726
- Source Project: C--work-mega
- Auto-detected: yes
- Aggregate All: no

## Tokens (totals)

- input: 96
- cache_create_5m: 0
- cache_create_1h: 36,022
- cache_read: 49,490,754
- output: 19,391

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 56 msgs (100%), $76.7726 (100%)

## Conversation Shape

- user_msg_count: 4
- user_msg_avg_len: 770
- turns_before_first_tool: 1
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 2

## Tool Usage

- Bash: 18
- Edit: 11
- Read: 5
- Agent: 2

## Tool Result Sizes (bytes)

- count: 35
- sum: 16,717
- p50: 207
- p90: 869
- max: 4,148

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 17 calls, 9,099B results, ~20,817 cache_create tok (2.29×)
- Edit: 11 calls, 1,933B results, ~5,022 cache_create tok (2.6×)
- Agent: 2 calls, 1,738B results, ~4,881 cache_create tok (2.81×)
- Read: 5 calls, 3,947B results, ~4,234 cache_create tok (1.07×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 56
- usd: $76.7726
- input: 96
- cache_create_5m: 0
- cache_create_1h: 36,022
- cache_read: 49,490,754
- output: 19,391

