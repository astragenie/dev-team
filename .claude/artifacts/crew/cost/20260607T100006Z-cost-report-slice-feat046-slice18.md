---
kind: cost-report
feature: FEAT-046
run_title: "FEAT046 SLICE18"
usd: 0.9526
duration_ms: 420562
total_tokens: 2556267
cache_hit_pct: 99.5
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T10:00:06.575Z
---

# Cost Report: FEAT046 SLICE18

- Created: 2026-06-07T10:00:06.575Z
- Run Title: FEAT046 SLICE18
- Window Start: 2026-06-07T09:53:05.692Z
- Window End: 2026-06-07T10:00:06.254Z
- Duration: 7.0 min (420562 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 16
- Total Tokens: 2,556,267
- Cache Hit %: 99.5%
- Total USD: $0.9526
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 16
- cache_create_5m: 0
- cache_create_1h: 12,196
- cache_read: 2,536,154
- output: 7,901

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 16 msgs (100%), $0.9526 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 1

## Tool Usage

- Bash: 6
- Read: 3
- Agent: 1
- Edit: 1

## Tool Result Sizes (bytes)

- count: 12
- sum: 13,620
- p50: 121
- p90: 3,985
- max: 4,399

## File Re-reads

- redundant_read_count: 1
- top paths:
  - 2× C:/work/mega/hero-crew/docs/superpowers/plans/2026-06-05-feat-d-builder-dispatch-reliability.md

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Read: 3 calls, 8,458B results, ~6,518 cache_create tok (0.77×)
- Agent: 1 calls, 3,782B results, ~2,835 cache_create tok (0.75×)
- Bash: 6 calls, 1,106B results, ~2,519 cache_create tok (2.28×)
- Edit: 1 calls, 208B results, ~0 cache_create tok (0×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 16
- usd: $0.9526
- input: 16
- cache_create_5m: 0
- cache_create_1h: 12,196
- cache_read: 2,536,154
- output: 7,901

