---
kind: cost-report
feature: FEAT-123
run_title: "FEAT123 SLICE53"
usd: 1.4264
duration_ms: 439399
total_tokens: 3742354
cache_hit_pct: 99.6
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-08T16:51:57.422Z
---

# Cost Report: FEAT123 SLICE53

- Created: 2026-06-08T16:51:57.422Z
- Run Title: FEAT123 SLICE53
- Window Start: 2026-06-08T16:44:37.665Z
- Window End: 2026-06-08T16:51:57.064Z
- Duration: 7.3 min (439399 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 25
- Total Tokens: 3,742,354
- Cache Hit %: 99.6%
- Total USD: $1.4264
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 31
- cache_create_5m: 0
- cache_create_1h: 16,262
- cache_read: 3,711,711
- output: 14,350

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 25 msgs (100%), $1.4264 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 2

## Tool Usage

- Bash: 8
- Read: 3
- Edit: 3
- Agent: 2

## Tool Result Sizes (bytes)

- count: 17
- sum: 10,223
- p50: 236
- p90: 1,510
- max: 1,594

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Agent: 2 calls, 2,542B results, ~10,573 cache_create tok (4.16×)
- Bash: 8 calls, 4,431B results, ~2,383 cache_create tok (0.54×)
- Edit: 3 calls, 506B results, ~1,873 cache_create tok (3.7×)
- Read: 3 calls, 2,617B results, ~1,205 cache_create tok (0.46×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 25
- usd: $1.4264
- input: 31
- cache_create_5m: 0
- cache_create_1h: 16,262
- cache_read: 3,711,711
- output: 14,350

