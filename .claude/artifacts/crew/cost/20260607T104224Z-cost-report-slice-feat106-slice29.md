---
kind: cost-report
feature: FEAT-106
run_title: "FEAT106 SLICE29"
usd: 1.0551
duration_ms: 466338
total_tokens: 2135414
cache_hit_pct: 98.6
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T10:42:24.396Z
---

# Cost Report: FEAT106 SLICE29

- Created: 2026-06-07T10:42:24.396Z
- Run Title: FEAT106 SLICE29
- Window Start: 2026-06-07T10:34:37.760Z
- Window End: 2026-06-07T10:42:24.098Z
- Duration: 7.8 min (466338 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 22
- Total Tokens: 2,135,414
- Cache Hit %: 98.6%
- Total USD: $1.0551
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 26
- cache_create_5m: 0
- cache_create_1h: 28,844
- cache_read: 2,089,537
- output: 17,007

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 22 msgs (100%), $1.0551 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 2
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 2

## Tool Usage

- Bash: 6
- Agent: 2
- Edit: 2
- Read: 1

## Tool Result Sizes (bytes)

- count: 12
- sum: 21,119
- p50: 1,782
- p90: 4,151
- max: 6,224

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 6 calls, 13,050B results, ~12,519 cache_create tok (0.96×)
- Agent: 2 calls, 3,811B results, ~11,578 cache_create tok (3.04×)
- Read: 1 calls, 1,782B results, ~1,656 cache_create tok (0.93×)
- Edit: 2 calls, 354B results, ~538 cache_create tok (1.52×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 22
- usd: $1.0551
- input: 26
- cache_create_5m: 0
- cache_create_1h: 28,844
- cache_read: 2,089,537
- output: 17,007

