---
kind: cost-report
feature: FEAT-103
run_title: "FEAT103 SLICE21"
usd: 2.0244
duration_ms: 225986
total_tokens: 5798884
cache_hit_pct: 99.6
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T10:20:56.144Z
---

# Cost Report: FEAT103 SLICE21

- Created: 2026-06-07T10:20:56.144Z
- Run Title: FEAT103 SLICE21
- Window Start: 2026-06-07T10:17:09.865Z
- Window End: 2026-06-07T10:20:55.851Z
- Duration: 3.8 min (225986 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 42
- Total Tokens: 5,798,884
- Cache Hit %: 99.6%
- Total USD: $2.0244
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 42
- cache_create_5m: 0
- cache_create_1h: 20,747
- cache_read: 5,766,775
- output: 11,320

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 42 msgs (100%), $2.0244 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 1
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 0

## Tool Usage

- Bash: 15
- Read: 8
- Edit: 5
- Write: 2

## Tool Result Sizes (bytes)

- count: 30
- sum: 16,750
- p50: 233
- p90: 1,673
- max: 2,705

## File Re-reads

- redundant_read_count: 5
- top paths:
  - 3× C:\work\mega\hero-crew\scripts\lib\cost-advisor.mjs
  - 3× C:\work\mega\hero-crew\scripts\lib\deployment-guidance.mjs
  - 2× C:\work\mega\hero-crew\scripts\lib\briefing\collect.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 14 calls, 6,284B results, ~7,002 cache_create tok (1.11×)
- Read: 8 calls, 6,653B results, ~5,533 cache_create tok (0.83×)
- Edit: 5 calls, 811B results, ~3,371 cache_create tok (4.16×)
- Write: 2 calls, 297B results, ~2,531 cache_create tok (8.52×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 42
- usd: $2.0244
- input: 42
- cache_create_5m: 0
- cache_create_1h: 20,747
- cache_read: 5,766,775
- output: 11,320

