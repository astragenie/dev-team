---
kind: cost-report
feature: FEAT-122
run_title: "FEAT122 SLICE48"
usd: 15.2434
duration_ms: 813199
total_tokens: 4367947
cache_hit_pct: 95.0
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-08T04:03:18.003Z
---

# Cost Report: FEAT122 SLICE48

- Created: 2026-06-08T04:03:18.003Z
- Run Title: FEAT122 SLICE48
- Window Start: 2026-06-08T03:49:44.448Z
- Window End: 2026-06-08T04:03:17.647Z
- Duration: 13.6 min (813199 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 30
- Total Tokens: 4,367,947
- Cache Hit %: 95.0%
- Total USD: $15.2434
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 85
- cache_create_5m: 0
- cache_create_1h: 214,471
- cache_read: 4,118,318
- output: 35,073

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 30 msgs (100%), $15.2434 (100%)

## Conversation Shape

- user_msg_count: 3
- user_msg_avg_len: 910
- turns_before_first_tool: 3
- compaction_count: 2
- skill_invocations: 0
- subagent_dispatches: 2

## Tool Usage

- TaskCreate: 6
- Read: 4
- TaskUpdate: 3
- Agent: 2
- ToolSearch: 2
- Write: 1

## Tool Result Sizes (bytes)

- count: 19
- sum: 24,940
- p50: 77
- p90: 4,993
- max: 5,880

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- ToolSearch: 2 calls, 153B results, ~136,082 cache_create tok (889.42×)
- Write: 1 calls, 191B results, ~32,097 cache_create tok (168.05×)
- Agent: 2 calls, 5,809B results, ~27,449 cache_create tok (4.73×)
- Read: 4 calls, 15,976B results, ~12,686 cache_create tok (0.79×)
- TaskCreate: 6 calls, 366B results, ~1,187 cache_create tok (3.24×)
- TaskUpdate: 3 calls, 66B results, ~378 cache_create tok (5.73×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 30
- usd: $15.2434
- input: 85
- cache_create_5m: 0
- cache_create_1h: 214,471
- cache_read: 4,118,318
- output: 35,073

