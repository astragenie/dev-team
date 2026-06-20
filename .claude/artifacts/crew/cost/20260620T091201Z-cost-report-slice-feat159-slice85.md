---
kind: cost-report
feature: FEAT-159
run_title: "FEAT159 SLICE85"
usd: 17.1539
duration_ms: 223058
total_tokens: 10155662
cache_hit_pct: 99.8
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-20T09:12:01.016Z
---

# Cost Report: FEAT159 SLICE85

- Created: 2026-06-20T09:12:01.016Z
- Run Title: FEAT159 SLICE85
- Window Start: 2026-06-20T09:08:16.907Z
- Window End: 2026-06-20T09:11:59.965Z
- Duration: 3.7 min (223058 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 31
- Total Tokens: 10,155,662
- Cache Hit %: 99.8%
- Total USD: $17.1539
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 31
- cache_create_5m: 0
- cache_create_1h: 16,872
- cache_read: 10,119,179
- output: 19,580

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 31 msgs (100%), $17.1539 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 1
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 0

## Tool Usage

- Bash: 10
- Edit: 8
- Read: 2
- Write: 1

## Tool Result Sizes (bytes)

- count: 22
- sum: 5,069
- p50: 166
- p90: 495
- max: 841

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 10 calls, 2,478B results, ~6,722 cache_create tok (2.71×)
- Edit: 8 calls, 1,325B results, ~5,859 cache_create tok (4.42×)
- Write: 1 calls, 164B results, ~2,981 cache_create tok (18.18×)
- Read: 2 calls, 1,003B results, ~810 cache_create tok (0.81×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 31
- usd: $17.1539
- input: 31
- cache_create_5m: 0
- cache_create_1h: 16,872
- cache_read: 10,119,179
- output: 19,580

