---
kind: cost-report
feature: FEAT-003
run_title: "FEAT003 SLICE07"
usd: 2.5641
duration_ms: 61855
total_tokens: 1586990
cache_hit_pct: 99.8
source_project: aggregate
aggregate_all: true
source_count: 2
created_at: 2026-05-27T05:27:01.878Z
---

# Cost Report: FEAT003 SLICE07

- Created: 2026-05-27T05:27:01.878Z
- Run Title: FEAT003 SLICE07
- Window Start: 2026-05-27T05:18:30.830Z
- Window End: 2026-05-27T05:19:32.685Z
- Duration: 1.0 min (61855 ms)
- Sessions Scanned: 2
- Assistant Messages Counted: 6
- Total Tokens: 1,586,990
- Cache Hit %: 99.8%
- Total USD: $2.5641
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-hero-crew: 5 msgs, $2.4086
- C--work-mega-Astra-Humanizer: 1 msgs, $0.1555

## Tokens (totals)

- input: 8
- cache_create_5m: 0
- cache_create_1h: 3,693
- cache_read: 1,573,759
- output: 9,530

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 5 msgs (83.33%), $2.4086 (93.93%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 1 msgs (16.67%), $0.1555 (6.06%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 0
- compaction_count: 1
- skill_invocations: 0
- subagent_dispatches: 2

## Tool Usage

- Bash: 3
- Agent: 2

## Tool Result Sizes (bytes)

- count: 4
- sum: 3,304
- p50: 879
- p90: 1,903
- max: 1,903

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Agent: 1 calls, 879B results, ~2,603 cache_create tok (2.96×)
- Bash: 2 calls, 522B results, ~587 cache_create tok (1.12×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 1
- usd: $0.1555
- input: 1
- cache_create_5m: 0
- cache_create_1h: 503
- cache_read: 107,512
- output: 8,018

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 5
- usd: $2.4086
- input: 7
- cache_create_5m: 0
- cache_create_1h: 3,190
- cache_read: 1,466,247
- output: 1,512

