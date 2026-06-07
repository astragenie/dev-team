---
kind: cost-report
feature: FEAT-111
run_title: "FEAT111 SLICE35"
usd: 2.2265
duration_ms: 1606820
total_tokens: 3446884
cache_hit_pct: 97.5
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T11:49:12.704Z
---

# Cost Report: FEAT111 SLICE35

- Created: 2026-06-07T11:49:12.704Z
- Run Title: FEAT111 SLICE35
- Window Start: 2026-06-07T11:22:25.561Z
- Window End: 2026-06-07T11:49:12.381Z
- Duration: 26.8 min (1606820 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 38
- Total Tokens: 3,446,884
- Cache Hit %: 97.5%
- Total USD: $2.2265
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 60
- cache_create_5m: 0
- cache_create_1h: 85,755
- cache_read: 3,313,217
- output: 47,852

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 38 msgs (100%), $2.2265 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 5

## Tool Usage

- Read: 9
- Bash: 8
- Agent: 5

## Tool Result Sizes (bytes)

- count: 23
- sum: 55,066
- p50: 1,313
- p90: 5,010
- max: 20,336

## File Re-reads

- redundant_read_count: 4
- top paths:
  - 3× C:\work\mega\hero-crew\scripts\lib\briefing\collect.ts
  - 3× C:\work\mega\hero-crew\scripts\lib\briefing.ts

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Read: 9 calls, 41,620B results, ~40,465 cache_create tok (0.97×)
- Agent: 5 calls, 7,902B results, ~39,057 cache_create tok (4.94×)
- Bash: 8 calls, 3,425B results, ~5,387 cache_create tok (1.57×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 38
- usd: $2.2265
- input: 60
- cache_create_5m: 0
- cache_create_1h: 85,755
- cache_read: 3,313,217
- output: 47,852

