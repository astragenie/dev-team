---
kind: cost-report
feature: FEAT-125
run_title: "FEAT125 SLICE51"
usd: 1.6293
duration_ms: 327484
total_tokens: 3713096
cache_hit_pct: 98.8
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-08T16:35:53.536Z
---

# Cost Report: FEAT125 SLICE51

- Created: 2026-06-08T16:35:53.536Z
- Run Title: FEAT125 SLICE51
- Window Start: 2026-06-08T16:30:25.597Z
- Window End: 2026-06-08T16:35:53.081Z
- Duration: 5.5 min (327484 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 31
- Total Tokens: 3,713,096
- Cache Hit %: 98.8%
- Total USD: $1.6293
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 31
- cache_create_5m: 0
- cache_create_1h: 45,037
- cache_read: 3,650,438
- output: 17,590

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 31 msgs (100%), $1.6293 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 1
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 2

## Tool Usage

- Bash: 11
- Read: 4
- Agent: 2
- Edit: 1

## Tool Result Sizes (bytes)

- count: 19
- sum: 36,636
- p50: 866
- p90: 9,937
- max: 14,008

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Read: 4 calls, 26,290B results, ~24,183 cache_create tok (0.92×)
- Agent: 2 calls, 2,260B results, ~12,723 cache_create tok (5.63×)
- Bash: 11 calls, 5,657B results, ~4,150 cache_create tok (0.73×)
- Edit: 1 calls, 229B results, ~1,193 cache_create tok (5.21×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 31
- usd: $1.6293
- input: 31
- cache_create_5m: 0
- cache_create_1h: 45,037
- cache_read: 3,650,438
- output: 17,590

