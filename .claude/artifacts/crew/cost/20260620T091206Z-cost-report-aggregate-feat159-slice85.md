---
kind: cost-report
feature: FEAT-159
run_title: "FEAT159 SLICE85"
usd: 51.3457
duration_ms: 224119
total_tokens: 29019304
cache_hit_pct: 99.7
source_project: aggregate
aggregate_all: true
source_count: 2
created_at: 2026-06-20T09:12:06.172Z
---

# Cost Report: FEAT159 SLICE85

- Created: 2026-06-20T09:12:06.172Z
- Run Title: FEAT159 SLICE85
- Window Start: 2026-06-20T09:08:16.907Z
- Window End: 2026-06-20T09:12:01.026Z
- Duration: 3.7 min (224119 ms)
- Sessions Scanned: 2
- Assistant Messages Counted: 58
- Total Tokens: 29,019,304
- Cache Hit %: 99.7%
- Total USD: $51.3457
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-devops: 26 msgs, $33.6292
- C--work-mega-hero-crew: 32 msgs, $17.7165

## Tokens (totals)

- input: 58
- cache_create_5m: 0
- cache_create_1h: 72,675
- cache_read: 28,868,412
- output: 78,159

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 58 msgs (100%), $51.3457 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 0

## Tool Usage

- Bash: 21
- Edit: 13 (1 failed)
- Read: 4
- Write: 1

## Tool Result Sizes (bytes)

- count: 40
- sum: 15,844
- p50: 169
- p90: 841
- max: 3,248

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 20 calls, 9,813B results, ~47,790 cache_create tok (4.87×)
- Edit: 13 calls, 2,097B results, ~17,797 cache_create tok (8.49×)
- Write: 1 calls, 164B results, ~2,981 cache_create tok (18.18×)
- Read: 4 calls, 3,185B results, ~2,145 cache_create tok (0.67×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 58
- usd: $51.3457
- input: 58
- cache_create_5m: 0
- cache_create_1h: 72,675
- cache_read: 28,868,412
- output: 78,159

