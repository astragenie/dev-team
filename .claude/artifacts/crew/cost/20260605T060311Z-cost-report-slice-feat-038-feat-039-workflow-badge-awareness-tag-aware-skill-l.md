---
kind: cost-report
run_title: "FEAT-038 + FEAT-039: Workflow badge awareness + tag-aware skill loading"
usd: 3.7304
duration_ms: 517906
total_tokens: 7477220
cache_hit_pct: 97.6
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-05T06:03:11.893Z
---

# Cost Report: FEAT-038 + FEAT-039: Workflow badge awareness + tag-aware skill loading

- Created: 2026-06-05T06:03:11.893Z
- Run Title: FEAT-038 + FEAT-039: Workflow badge awareness + tag-aware skill loading
- Window Start: 2026-06-05T05:54:33.764Z
- Window End: 2026-06-05T06:03:11.670Z
- Duration: 8.6 min (517906 ms)
- Sessions Scanned: 2
- Assistant Messages Counted: 78
- Total Tokens: 7,477,220
- Cache Hit %: 97.6%
- Total USD: $3.7304
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 84
- cache_create_5m: 0
- cache_create_1h: 175,041
- cache_read: 7,268,813
- output: 33,282

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 78 msgs (100%), $3.7304 (100%)

## Conversation Shape

- user_msg_count: 1
- user_msg_avg_len: 12212
- turns_before_first_tool: 1
- compaction_count: 1
- skill_invocations: 0
- subagent_dispatches: 3

## Tool Usage

- Bash: 22 (1 failed)
- Read: 7
- Edit: 4
- Agent: 3
- Write: 1
- AskUserQuestion: 1
- PowerShell: 1

## Tool Result Sizes (bytes)

- count: 40
- sum: 73,807
- p50: 389
- p90: 2,378
- max: 22,194

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 22 calls, 42,029B results, ~44,040 cache_create tok (1.05×)
- Read: 7 calls, 26,660B results, ~27,693 cache_create tok (1.04×)
- Agent: 3 calls, 3,901B results, ~20,034 cache_create tok (5.14×)
- Write: 1 calls, 148B results, ~5,680 cache_create tok (38.38×)
- Edit: 4 calls, 611B results, ~1,453 cache_create tok (2.38×)
- AskUserQuestion: 1 calls, 158B results, ~601 cache_create tok (3.8×)
- PowerShell: 1 calls, 13B results, ~222 cache_create tok (17.08×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 78
- usd: $3.7304
- input: 84
- cache_create_5m: 0
- cache_create_1h: 175,041
- cache_read: 7,268,813
- output: 33,282

