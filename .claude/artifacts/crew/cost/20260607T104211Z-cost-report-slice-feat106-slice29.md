---
kind: cost-report
feature: FEAT-106
run_title: "FEAT106 SLICE29"
usd: 0.8325
duration_ms: 453537
total_tokens: 1626866
cache_hit_pct: 98.8
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T10:42:11.602Z
---

# Cost Report: FEAT106 SLICE29

- Created: 2026-06-07T10:42:11.602Z
- Run Title: FEAT106 SLICE29
- Window Start: 2026-06-07T10:34:37.760Z
- Window End: 2026-06-07T10:42:11.297Z
- Duration: 7.6 min (453537 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 17
- Total Tokens: 1,626,866
- Cache Hit %: 98.8%
- Total USD: $0.8325
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 21
- cache_create_5m: 0
- cache_create_1h: 19,344
- cache_read: 1,591,572
- output: 15,929

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 17 msgs (100%), $0.8325 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 2
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 2

## Tool Usage

- Bash: 4
- Agent: 2
- Edit: 2
- Read: 1

## Tool Result Sizes (bytes)

- count: 10
- sum: 13,037
- p50: 1,558
- p90: 4,151
- max: 4,151

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Agent: 2 calls, 3,811B results, ~9,068 cache_create tok (2.38×)
- Bash: 4 calls, 4,968B results, ~5,529 cache_create tok (1.11×)
- Read: 1 calls, 1,782B results, ~1,656 cache_create tok (0.93×)
- Edit: 2 calls, 354B results, ~538 cache_create tok (1.52×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 17
- usd: $0.8325
- input: 21
- cache_create_5m: 0
- cache_create_1h: 19,344
- cache_read: 1,591,572
- output: 15,929

