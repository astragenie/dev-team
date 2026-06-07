---
kind: cost-report
feature: FEAT-112
run_title: "FEAT112 SLICE36"
usd: 0.7867
duration_ms: 639395
total_tokens: 1955073
cache_hit_pct: 99.4
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T12:00:49.323Z
---

# Cost Report: FEAT112 SLICE36

- Created: 2026-06-07T12:00:49.323Z
- Run Title: FEAT112 SLICE36
- Window Start: 2026-06-07T11:50:09.571Z
- Window End: 2026-06-07T12:00:48.966Z
- Duration: 10.7 min (639395 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 17
- Total Tokens: 1,955,073
- Cache Hit %: 99.4%
- Total USD: $0.7867
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 17
- cache_create_5m: 0
- cache_create_1h: 11,942
- cache_read: 1,934,131
- output: 8,983

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 17 msgs (100%), $0.7867 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 4

## Tool Usage

- Bash: 6
- Agent: 4

## Tool Result Sizes (bytes)

- count: 11
- sum: 8,429
- p50: 448
- p90: 1,928
- max: 2,261

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 6 calls, 4,024B results, ~5,762 cache_create tok (1.43×)
- Agent: 4 calls, 3,386B results, ~5,677 cache_create tok (1.68×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 17
- usd: $0.7867
- input: 17
- cache_create_5m: 0
- cache_create_1h: 11,942
- cache_read: 1,934,131
- output: 8,983

