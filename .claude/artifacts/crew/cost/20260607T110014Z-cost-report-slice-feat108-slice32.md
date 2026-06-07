---
kind: cost-report
feature: FEAT-108
run_title: "FEAT108 SLICE32"
usd: 0.6536
duration_ms: 420602
total_tokens: 1604493
cache_hit_pct: 99.0
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T11:00:14.675Z
---

# Cost Report: FEAT108 SLICE32

- Created: 2026-06-07T11:00:14.675Z
- Run Title: FEAT108 SLICE32
- Window Start: 2026-06-07T10:53:13.750Z
- Window End: 2026-06-07T11:00:14.352Z
- Duration: 7.0 min (420602 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 12
- Total Tokens: 1,604,493
- Cache Hit %: 99.0%
- Total USD: $0.6536
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 12
- cache_create_5m: 0
- cache_create_1h: 16,422
- cache_read: 1,582,709
- output: 5,350

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 12 msgs (100%), $0.6536 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 1

## Tool Usage

- Bash: 7
- Read: 1
- Agent: 1

## Tool Result Sizes (bytes)

- count: 10
- sum: 19,841
- p50: 1,287
- p90: 10,528
- max: 10,528

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 7 calls, 15,234B results, ~12,052 cache_create tok (0.79×)
- Agent: 1 calls, 2,051B results, ~2,195 cache_create tok (1.07×)
- Read: 1 calls, 2,451B results, ~1,860 cache_create tok (0.76×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 12
- usd: $0.6536
- input: 12
- cache_create_5m: 0
- cache_create_1h: 16,422
- cache_read: 1,582,709
- output: 5,350

