---
kind: cost-report
feature: FEAT-124
run_title: "FEAT124 SLICE46"
usd: 6.238
duration_ms: 1689033
total_tokens: 2730131
cache_hit_pct: 99.0
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T22:54:26.084Z
---

# Cost Report: FEAT124 SLICE46

- Created: 2026-06-07T22:54:26.084Z
- Run Title: FEAT124 SLICE46
- Window Start: 2026-06-07T22:26:16.711Z
- Window End: 2026-06-07T22:54:25.744Z
- Duration: 28.2 min (1689033 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 20
- Total Tokens: 2,730,131
- Cache Hit %: 99.0%
- Total USD: $6.2380
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 20
- cache_create_5m: 0
- cache_create_1h: 28,353
- cache_read: 2,683,602
- output: 18,156

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 20 msgs (100%), $6.2380 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 2
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 2

## Tool Usage

- Bash: 5
- Agent: 2
- Edit: 2 (1 failed)
- Read: 1

## Tool Result Sizes (bytes)

- count: 10
- sum: 7,385
- p50: 412
- p90: 2,308
- max: 2,308

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Agent: 2 calls, 3,553B results, ~17,826 cache_create tok (5.02×)
- Bash: 4 calls, 866B results, ~4,694 cache_create tok (5.42×)
- Edit: 2 calls, 246B results, ~899 cache_create tok (3.65×)
- Read: 1 calls, 412B results, ~308 cache_create tok (0.75×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 20
- usd: $6.2380
- input: 20
- cache_create_5m: 0
- cache_create_1h: 28,353
- cache_read: 2,683,602
- output: 18,156

