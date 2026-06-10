---
kind: cost-report
run_title: "FEAT-148 builder scoped self-verify"
usd: 20.0208
duration_ms: 247391
total_tokens: 10644673
cache_hit_pct: 99.3
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-10T19:59:53.232Z
---

# Cost Report: FEAT-148 builder scoped self-verify

- Created: 2026-06-10T19:59:53.232Z
- Run Title: FEAT-148 builder scoped self-verify
- Window Start: 2026-06-10T19:55:45.231Z
- Window End: 2026-06-10T19:59:52.622Z
- Duration: 4.1 min (247391 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 30
- Total Tokens: 10,644,673
- Cache Hit %: 99.3%
- Total USD: $20.0208
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 12,369
- cache_create_5m: 0
- cache_create_1h: 57,889
- cache_read: 10,543,980
- output: 30,435

## Model Mix

- claude-opus-4-8 (priced as claude-opus-4): 30 msgs (100%), $20.0208 (100%)

## Conversation Shape

- user_msg_count: 1
- user_msg_avg_len: 15
- turns_before_first_tool: 2
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 0

## Tool Usage

- Bash: 5
- Read: 3
- Edit: 3

## Tool Result Sizes (bytes)

- count: 11
- sum: 14,457
- p50: 990
- p90: 1,880
- max: 5,335

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 4 calls, 7,782B results, ~26,872 cache_create tok (3.45×)
- Read: 3 calls, 4,351B results, ~10,803 cache_create tok (2.48×)
- Edit: 3 calls, 444B results, ~6,306 cache_create tok (14.2×)


## By Model (token detail)

### claude-opus-4-8 (priced as claude-opus-4)
- messages: 30
- usd: $20.0208
- input: 12,369
- cache_create_5m: 0
- cache_create_1h: 57,889
- cache_read: 10,543,980
- output: 30,435

