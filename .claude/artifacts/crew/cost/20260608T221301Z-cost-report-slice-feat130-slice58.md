---
kind: cost-report
feature: FEAT-130
run_title: "FEAT130 SLICE58"
usd: 4.7639
duration_ms: 948229
total_tokens: 3213848
cache_hit_pct: 96.0
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-08T22:13:01.269Z
---

# Cost Report: FEAT130 SLICE58

- Created: 2026-06-08T22:13:01.269Z
- Run Title: FEAT130 SLICE58
- Window Start: 2026-06-08T21:57:12.611Z
- Window End: 2026-06-08T22:13:00.840Z
- Duration: 15.8 min (948229 ms)
- Sessions Scanned: 2
- Assistant Messages Counted: 41
- Total Tokens: 3,213,848
- Cache Hit %: 96.0%
- Total USD: $4.7639
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 55
- cache_create_5m: 0
- cache_create_1h: 128,994
- cache_read: 3,070,375
- output: 14,424

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 2 msgs (4.88%), $3.5653 (74.84%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 39 msgs (95.12%), $1.1985 (25.16%)

## Conversation Shape

- user_msg_count: 1
- user_msg_avg_len: 124
- turns_before_first_tool: 1
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 4

## Tool Usage

- Edit: 9
- Agent: 4
- Read: 4
- Grep: 4
- Bash: 4
- Glob: 1

## Tool Result Sizes (bytes)

- count: 27
- sum: 14,643
- p50: 158
- p90: 1,892
- max: 3,572

## File Re-reads

- redundant_read_count: 2
- top paths:
  - 3× C:\work\mega\hero-crew\scripts\prune-artifacts.ts

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Agent: 4 calls, 5,180B results, ~11,458 cache_create tok (2.21×)
- Edit: 9 calls, 1,433B results, ~3,288 cache_create tok (2.29×)
- Read: 4 calls, 4,273B results, ~2,986 cache_create tok (0.7×)
- Grep: 4 calls, 970B results, ~1,648 cache_create tok (1.7×)
- Bash: 4 calls, 621B results, ~1,631 cache_create tok (2.63×)
- Glob: 1 calls, 29B results, ~113 cache_create tok (3.9×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 2
- usd: $3.5653
- input: 12
- cache_create_5m: 0
- cache_create_1h: 107,870
- cache_read: 40,476
- output: 3,578

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 39
- usd: $1.1985
- input: 43
- cache_create_5m: 0
- cache_create_1h: 21,124
- cache_read: 3,029,899
- output: 10,846

