---
kind: cost-report
feature: FEAT-046
run_title: "FEAT046 SLICE18"
usd: 0.7425
duration_ms: 403885
total_tokens: 1909238
cache_hit_pct: 99.4
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T09:59:49.878Z
---

# Cost Report: FEAT046 SLICE18

- Created: 2026-06-07T09:59:49.878Z
- Run Title: FEAT046 SLICE18
- Window Start: 2026-06-07T09:53:05.692Z
- Window End: 2026-06-07T09:59:49.577Z
- Duration: 6.7 min (403885 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 12
- Total Tokens: 1,909,238
- Cache Hit %: 99.4%
- Total USD: $0.7425
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 12
- cache_create_5m: 0
- cache_create_1h: 10,891
- cache_read: 1,891,014
- output: 7,321

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 12 msgs (100%), $0.7425 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 1

## Tool Usage

- Bash: 4
- Read: 2
- Agent: 1

## Tool Result Sizes (bytes)

- count: 8
- sum: 13,257
- p50: 721
- p90: 4,399
- max: 4,399

## File Re-reads

- redundant_read_count: 1
- top paths:
  - 2× C:/work/mega/hero-crew/docs/superpowers/plans/2026-06-05-feat-d-builder-dispatch-reliability.md

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Read: 2 calls, 8,384B results, ~6,363 cache_create tok (0.76×)
- Agent: 1 calls, 3,782B results, ~2,835 cache_create tok (0.75×)
- Bash: 4 calls, 1,025B results, ~1,369 cache_create tok (1.34×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 12
- usd: $0.7425
- input: 12
- cache_create_5m: 0
- cache_create_1h: 10,891
- cache_read: 1,891,014
- output: 7,321

