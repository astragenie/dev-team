---
kind: cost-report
run_title: "FEAT-043: prompt/doc test coverage"
usd: 12.2192
duration_ms: 904724
total_tokens: 22976493
cache_hit_pct: 97.6
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-05T09:34:59.046Z
---

# Cost Report: FEAT-043: prompt/doc test coverage

- Created: 2026-06-05T09:34:59.046Z
- Run Title: FEAT-043: prompt/doc test coverage
- Window Start: 2026-06-05T09:19:54.071Z
- Window End: 2026-06-05T09:34:58.795Z
- Duration: 15.1 min (904724 ms)
- Sessions Scanned: 2
- Assistant Messages Counted: 180
- Total Tokens: 22,976,493
- Cache Hit %: 97.6%
- Total USD: $12.2192
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 204
- cache_create_5m: 0
- cache_create_1h: 536,458
- cache_read: 22,285,550
- output: 154,281

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 180 msgs (100%), $12.2192 (100%)

## Conversation Shape

- user_msg_count: 1
- user_msg_avg_len: 15431
- turns_before_first_tool: 1
- compaction_count: 2
- skill_invocations: 1
- subagent_dispatches: 1

## Tool Usage

- Bash: 95
- Read: 15
- Edit: 7
- Write: 6
- Agent: 1
- Skill: 1

## Tool Result Sizes (bytes)

- count: 126
- sum: 92,935
- p50: 446
- p90: 2,102
- max: 3,913

## File Re-reads

- redundant_read_count: 1
- top paths:
  - 2× C:/work/mega/hero-crew/hooks/check-redundant-read.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 95 calls, 65,698B results, ~247,812 cache_create tok (3.77×)
- Write: 6 calls, 1,050B results, ~235,368 cache_create tok (224.16×)
- Read: 15 calls, 22,192B results, ~35,452 cache_create tok (1.6×)
- Edit: 7 calls, 1,129B results, ~5,984 cache_create tok (5.3×)
- Agent: 1 calls, 2,614B results, ~5,700 cache_create tok (2.18×)
- Skill: 1 calls, 42B results, ~5,160 cache_create tok (122.86×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 180
- usd: $12.2192
- input: 204
- cache_create_5m: 0
- cache_create_1h: 536,458
- cache_read: 22,285,550
- output: 154,281

