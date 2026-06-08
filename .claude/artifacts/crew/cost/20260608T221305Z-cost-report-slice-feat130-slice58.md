---
kind: cost-report
feature: FEAT-130
run_title: "FEAT130 SLICE58"
usd: 5.36
duration_ms: 952405
total_tokens: 3526659
cache_hit_pct: 96.2
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-08T22:13:05.564Z
---

# Cost Report: FEAT130 SLICE58

- Created: 2026-06-08T22:13:05.564Z
- Run Title: FEAT130 SLICE58
- Window Start: 2026-06-08T21:57:12.611Z
- Window End: 2026-06-08T22:13:05.016Z
- Duration: 15.9 min (952405 ms)
- Sessions Scanned: 2
- Assistant Messages Counted: 45
- Total Tokens: 3,526,659
- Cache Hit %: 96.2%
- Total USD: $5.3600
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 59
- cache_create_5m: 0
- cache_create_1h: 135,018
- cache_read: 3,376,132
- output: 15,450

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 5 msgs (11.11%), $4.1314 (77.08%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 40 msgs (88.89%), $1.2286 (22.92%)

## Conversation Shape

- user_msg_count: 1
- user_msg_avg_len: 124
- turns_before_first_tool: 1
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 4

## Tool Usage

- Edit: 9
- Bash: 6 (1 failed)
- Agent: 4
- Read: 4
- Grep: 4
- Glob: 1

## Tool Result Sizes (bytes)

- count: 28
- sum: 15,363
- p50: 158
- p90: 1,892
- max: 3,572

## File Re-reads

- redundant_read_count: 2
- top paths:
  - 3× C:\work\mega\hero-crew\scripts\prune-artifacts.ts

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Agent: 4 calls, 5,180B results, ~14,611 cache_create tok (2.82×)
- Bash: 5 calls, 1,341B results, ~4,238 cache_create tok (3.16×)
- Edit: 9 calls, 1,433B results, ~3,552 cache_create tok (2.48×)
- Read: 4 calls, 4,273B results, ~2,986 cache_create tok (0.7×)
- Grep: 4 calls, 970B results, ~1,648 cache_create tok (1.7×)
- Glob: 1 calls, 29B results, ~113 cache_create tok (3.9×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 5
- usd: $4.1314
- input: 15
- cache_create_5m: 0
- cache_create_1h: 113,630
- cache_read: 262,995
- output: 4,370

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 40
- usd: $1.2286
- input: 44
- cache_create_5m: 0
- cache_create_1h: 21,388
- cache_read: 3,113,137
- output: 11,080

