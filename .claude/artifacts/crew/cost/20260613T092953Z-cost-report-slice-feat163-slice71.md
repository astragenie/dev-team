---
kind: cost-report
feature: FEAT-163
run_title: "FEAT163 SLICE71"
usd: 8.0785
duration_ms: 570631
total_tokens: 3822609
cache_hit_pct: 98.6
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-13T09:29:53.612Z
---

# Cost Report: FEAT163 SLICE71

- Created: 2026-06-13T09:29:53.612Z
- Run Title: FEAT163 SLICE71
- Window Start: 2026-06-13T09:20:22.456Z
- Window End: 2026-06-13T09:29:53.087Z
- Duration: 9.5 min (570631 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 15
- Total Tokens: 3,822,609
- Cache Hit %: 98.6%
- Total USD: $8.0785
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 30
- cache_create_5m: 0
- cache_create_1h: 54,153
- cache_read: 3,757,531
- output: 10,895

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 15 msgs (100%), $8.0785 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 1
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 2

## Tool Usage

- Bash: 5
- Agent: 2
- Grep: 1

## Tool Result Sizes (bytes)

- count: 9
- sum: 14,505
- p50: 247
- p90: 8,654
- max: 8,654

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Agent: 2 calls, 4,830B results, ~43,194 cache_create tok (8.94×)
- Bash: 5 calls, 924B results, ~2,225 cache_create tok (2.41×)
- Grep: 1 calls, 97B results, ~618 cache_create tok (6.37×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 15
- usd: $8.0785
- input: 30
- cache_create_5m: 0
- cache_create_1h: 54,153
- cache_read: 3,757,531
- output: 10,895

