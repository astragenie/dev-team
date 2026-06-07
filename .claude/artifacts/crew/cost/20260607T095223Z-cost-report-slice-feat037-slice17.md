---
kind: cost-report
feature: FEAT-037
run_title: "FEAT037 SLICE17"
usd: 2.276
duration_ms: 586023
total_tokens: 6335099
cache_hit_pct: 99.6
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T09:52:23.458Z
---

# Cost Report: FEAT037 SLICE17

- Created: 2026-06-07T09:52:23.458Z
- Run Title: FEAT037 SLICE17
- Window Start: 2026-06-07T09:42:37.138Z
- Window End: 2026-06-07T09:52:23.161Z
- Duration: 9.8 min (586023 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 44
- Total Tokens: 6,335,099
- Cache Hit %: 99.6%
- Total USD: $2.2760
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 44
- cache_create_5m: 0
- cache_create_1h: 26,285
- cache_read: 6,293,426
- output: 15,344

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 44 msgs (100%), $2.2760 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 1
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 2

## Tool Usage

- Bash: 20
- Read: 5
- Agent: 2
- Edit: 2

## Tool Result Sizes (bytes)

- count: 30
- sum: 17,382
- p50: 269
- p90: 1,404
- max: 3,605

## File Re-reads

- redundant_read_count: 2
- top paths:
  - 3× C:/work/mega/hero-crew/tests/crew-write-review-result.test.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 20 calls, 8,733B results, ~11,577 cache_create tok (1.33×)
- Agent: 2 calls, 3,858B results, ~10,359 cache_create tok (2.69×)
- Read: 5 calls, 4,166B results, ~2,613 cache_create tok (0.63×)
- Edit: 2 calls, 399B results, ~1,112 cache_create tok (2.79×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 44
- usd: $2.2760
- input: 44
- cache_create_5m: 0
- cache_create_1h: 26,285
- cache_read: 6,293,426
- output: 15,344

