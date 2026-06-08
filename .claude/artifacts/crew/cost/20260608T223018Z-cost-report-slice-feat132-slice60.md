---
kind: cost-report
feature: FEAT-132
run_title: "FEAT132 SLICE60"
usd: 5.7675
duration_ms: 405973
total_tokens: 5642739
cache_hit_pct: 99.4
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-08T22:30:18.732Z
---

# Cost Report: FEAT132 SLICE60

- Created: 2026-06-08T22:30:18.732Z
- Run Title: FEAT132 SLICE60
- Window Start: 2026-06-08T22:23:32.085Z
- Window End: 2026-06-08T22:30:18.058Z
- Duration: 6.8 min (405973 ms)
- Sessions Scanned: 2
- Assistant Messages Counted: 49
- Total Tokens: 5,642,739
- Cache Hit %: 99.4%
- Total USD: $5.7675
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 59
- cache_create_5m: 0
- cache_create_1h: 32,999
- cache_read: 5,578,878
- output: 30,803

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 21 msgs (42.86%), $4.2920 (74.42%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 28 msgs (57.14%), $1.4755 (25.58%)

## Conversation Shape

- user_msg_count: 1
- user_msg_avg_len: 99
- turns_before_first_tool: 1
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 1

## Tool Usage

- Read: 7
- Bash: 7
- AskUserQuestion: 4 (1 failed)
- Edit: 4
- TaskUpdate: 2
- Grep: 2
- Glob: 1
- Agent: 1

## Tool Result Sizes (bytes)

- count: 29
- sum: 16,546
- p50: 154
- p90: 2,390
- max: 3,342

## File Re-reads

- redundant_read_count: 5
- top paths:
  - 6× C:\work\mega\hero-crew\scripts\crew.ts

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Read: 7 calls, 9,854B results, ~12,599 cache_create tok (1.28×)
- AskUserQuestion: 4 calls, 1,286B results, ~7,453 cache_create tok (5.8×)
- Agent: 1 calls, 3,319B results, ~4,611 cache_create tok (1.39×)
- Edit: 4 calls, 619B results, ~2,110 cache_create tok (3.41×)
- Bash: 6 calls, 753B results, ~2,046 cache_create tok (2.72×)
- Glob: 1 calls, 234B results, ~1,258 cache_create tok (5.38×)
- TaskUpdate: 2 calls, 44B results, ~816 cache_create tok (18.55×)
- Grep: 2 calls, 164B results, ~450 cache_create tok (2.74×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 21
- usd: $4.2920
- input: 31
- cache_create_5m: 0
- cache_create_1h: 11,633
- cache_read: 2,152,076
- output: 9,526

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 28
- usd: $1.4755
- input: 28
- cache_create_5m: 0
- cache_create_1h: 21,366
- cache_read: 3,426,802
- output: 21,277

