---
kind: cost-report
feature: FEAT-142
run_title: "FEAT142 SLICE87"
usd: 16.7131
duration_ms: 217574
total_tokens: 9951314
cache_hit_pct: 99.8
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-20T09:44:27.390Z
---

# Cost Report: FEAT142 SLICE87

- Created: 2026-06-20T09:44:27.390Z
- Run Title: FEAT142 SLICE87
- Window Start: 2026-06-20T09:40:48.783Z
- Window End: 2026-06-20T09:44:26.357Z
- Duration: 3.6 min (217574 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 24
- Total Tokens: 9,951,314
- Cache Hit %: 99.8%
- Total USD: $16.7131
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 24
- cache_create_5m: 0
- cache_create_1h: 16,608
- cache_read: 9,916,825
- output: 17,857

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 24 msgs (100%), $16.7131 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 0

## Tool Usage

- Bash: 8
- Edit: 5
- Read: 2
- Write: 2

## Tool Result Sizes (bytes)

- count: 18
- sum: 8,724
- p50: 237
- p90: 1,309
- max: 3,066

## File Re-reads

- redundant_read_count: 1
- top paths:
  - 2× C:\work\mega\hero-crew\agents\architect.md

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Edit: 5 calls, 860B results, ~6,331 cache_create tok (7.36×)
- Write: 2 calls, 305B results, ~4,389 cache_create tok (14.39×)
- Bash: 8 calls, 3,089B results, ~3,550 cache_create tok (1.15×)
- Read: 2 calls, 4,375B results, ~2,095 cache_create tok (0.48×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 24
- usd: $16.7131
- input: 24
- cache_create_5m: 0
- cache_create_1h: 16,608
- cache_read: 9,916,825
- output: 17,857

