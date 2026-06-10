---
kind: cost-report
run_title: "FEAT-133 split briefing/collect.ts"
usd: 29.3671
duration_ms: 2567702
total_tokens: 14866640
cache_hit_pct: 99.4
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-10T08:36:28.103Z
---

# Cost Report: FEAT-133 split briefing/collect.ts

- Created: 2026-06-10T08:36:28.103Z
- Run Title: FEAT-133 split briefing/collect.ts
- Window Start: 2026-06-10T07:53:40.206Z
- Window End: 2026-06-10T08:36:27.908Z
- Duration: 42.8 min (2567702 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 67
- Total Tokens: 14,866,640
- Cache Hit %: 99.4%
- Total USD: $29.3671
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 2,546
- cache_create_5m: 0
- cache_create_1h: 88,418
- cache_read: 14,714,276
- output: 61,400

## Model Mix

- claude-opus-4-8 (priced as claude-opus-4): 67 msgs (100%), $29.3671 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 2
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 4

## Tool Usage

- Bash: 17 (1 failed)
- Agent: 4
- Read: 3
- Edit: 2 (1 failed)

## Tool Result Sizes (bytes)

- count: 26
- sum: 20,789
- p50: 304
- p90: 2,276
- max: 5,061

## File Re-reads

- redundant_read_count: 1
- top paths:
  - 2× C:/work/mega/hero-crew/scripts/lib/briefing/cost.ts

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 16 calls, 8,702B results, ~50,128 cache_create tok (5.76×)
- Agent: 4 calls, 5,347B results, ~22,134 cache_create tok (4.14×)
- Read: 3 calls, 6,276B results, ~9,480 cache_create tok (1.51×)
- Edit: 2 calls, 253B results, ~1,357 cache_create tok (5.36×)


## By Model (token detail)

### claude-opus-4-8 (priced as claude-opus-4)
- messages: 67
- usd: $29.3671
- input: 2,546
- cache_create_5m: 0
- cache_create_1h: 88,418
- cache_read: 14,714,276
- output: 61,400

