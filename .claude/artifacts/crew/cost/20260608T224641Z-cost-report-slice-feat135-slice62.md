---
kind: cost-report
feature: FEAT-135
run_title: "FEAT135 SLICE62"
usd: 0.6471
duration_ms: 140069
total_tokens: 837319
cache_hit_pct: 99.5
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-08T22:46:41.248Z
---

# Cost Report: FEAT135 SLICE62

- Created: 2026-06-08T22:46:41.248Z
- Run Title: FEAT135 SLICE62
- Window Start: 2026-06-08T22:44:20.774Z
- Window End: 2026-06-08T22:46:40.843Z
- Duration: 2.3 min (140069 ms)
- Sessions Scanned: 2
- Assistant Messages Counted: 6
- Total Tokens: 837,319
- Cache Hit %: 99.5%
- Total USD: $0.6471
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 16
- cache_create_5m: 0
- cache_create_1h: 4,069
- cache_read: 831,863
- output: 1,371

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 2 msgs (33.33%), $0.4407 (68.1%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 4 msgs (66.67%), $0.2064 (31.89%)

## Conversation Shape

- user_msg_count: 1
- user_msg_avg_len: 2
- turns_before_first_tool: 1
- compaction_count: 1
- skill_invocations: 1
- subagent_dispatches: 1

## Tool Usage

- Skill: 1
- Bash: 1
- Agent: 1
- Edit: 1

## Tool Result Sizes (bytes)

- count: 5
- sum: 3,139
- p50: 161
- p90: 2,732
- max: 2,732

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Agent: 1 calls, 2,732B results, ~2,696 cache_create tok (0.99×)
- Bash: 1 calls, 161B results, ~242 cache_create tok (1.5×)
- Skill: 1 calls, 42B results, ~231 cache_create tok (5.5×)
- Edit: 1 calls, 187B results, ~0 cache_create tok (0×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 2
- usd: $0.4407
- input: 12
- cache_create_5m: 0
- cache_create_1h: 900
- cache_read: 257,870
- output: 356

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 4
- usd: $0.2064
- input: 4
- cache_create_5m: 0
- cache_create_1h: 3,169
- cache_read: 573,993
- output: 1,015

