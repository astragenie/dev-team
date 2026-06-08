---
kind: cost-report
feature: FEAT-129
run_title: "FEAT129 SLICE57"
usd: 0.8988
duration_ms: 531805
total_tokens: 831662
cache_hit_pct: 87.1
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-08T21:56:46.689Z
---

# Cost Report: FEAT129 SLICE57

- Created: 2026-06-08T21:56:46.689Z
- Run Title: FEAT129 SLICE57
- Window Start: 2026-06-08T21:47:54.487Z
- Window End: 2026-06-08T21:56:46.292Z
- Duration: 8.9 min (531805 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 8
- Total Tokens: 831,662
- Cache Hit %: 87.1%
- Total USD: $0.8988
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 16
- cache_create_5m: 0
- cache_create_1h: 107,335
- cache_read: 721,762
- output: 2,549

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 8 msgs (100%), $0.8988 (100%)

## Conversation Shape

- user_msg_count: 1
- user_msg_avg_len: 12004
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 2

## Tool Usage

- Agent: 2
- Bash: 1
- Read: 1
- Edit: 1

## Tool Result Sizes (bytes)

- count: 6
- sum: 8,335
- p50: 1,298
- p90: 5,035
- max: 5,035

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Agent: 2 calls, 2,658B results, ~102,706 cache_create tok (38.64×)
- Bash: 1 calls, 5,035B results, ~4,098 cache_create tok (0.81×)
- Read: 1 calls, 364B results, ~305 cache_create tok (0.84×)
- Edit: 1 calls, 189B results, ~0 cache_create tok (0×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 8
- usd: $0.8988
- input: 16
- cache_create_5m: 0
- cache_create_1h: 107,335
- cache_read: 721,762
- output: 2,549

