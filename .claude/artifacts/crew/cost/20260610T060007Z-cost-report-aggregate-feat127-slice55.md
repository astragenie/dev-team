---
kind: cost-report
feature: FEAT-127
run_title: "FEAT127 SLICE55"
usd: 102.2312
duration_ms: 730729
total_tokens: 65258441
cache_hit_pct: 99.9
source_project: aggregate
aggregate_all: true
source_count: 2
created_at: 2026-06-10T06:00:07.502Z
---

# Cost Report: FEAT127 SLICE55

- Created: 2026-06-10T06:00:07.503Z
- Run Title: FEAT127 SLICE55
- Window Start: 2026-05-22T06:41:58.357Z
- Window End: 2026-05-22T06:54:09.086Z
- Duration: 12.2 min (730729 ms)
- Sessions Scanned: 2
- Assistant Messages Counted: 74
- Total Tokens: 65,258,441
- Cache Hit %: 99.9%
- Total USD: $102.2312
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega: 56 msgs, $76.7726
- C--work-mega-AstraGenie-MemoryService: 18 msgs, $25.4586

## Tokens (totals)

- input: 204
- cache_create_5m: 0
- cache_create_1h: 55,398
- cache_read: 65,165,262
- output: 37,577

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 74 msgs (100%), $102.2312 (100%)

## Conversation Shape

- user_msg_count: 13
- user_msg_avg_len: 238
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

- Bash: 17 calls, 9,099B results, ~40,193 cache_create tok (4.42×)
- Edit: 11 calls, 1,933B results, ~5,022 cache_create tok (2.6×)
- Agent: 2 calls, 1,738B results, ~4,881 cache_create tok (2.81×)
- Read: 5 calls, 3,947B results, ~4,234 cache_create tok (1.07×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 74
- usd: $102.2312
- input: 204
- cache_create_5m: 0
- cache_create_1h: 55,398
- cache_read: 65,165,262
- output: 37,577

