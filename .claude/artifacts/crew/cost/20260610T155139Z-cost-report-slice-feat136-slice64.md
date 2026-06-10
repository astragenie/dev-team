---
kind: cost-report
feature: FEAT-136
run_title: "FEAT136 SLICE64"
usd: 1.8816
duration_ms: 697312
total_tokens: 4657819
cache_hit_pct: 99.1
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-10T15:51:39.968Z
---

# Cost Report: FEAT136 SLICE64

- Created: 2026-06-10T15:51:39.968Z
- Run Title: FEAT136 SLICE64
- Window Start: 2026-06-10T15:40:02.248Z
- Window End: 2026-06-10T15:51:39.560Z
- Duration: 11.6 min (697312 ms)
- Sessions Scanned: 2
- Assistant Messages Counted: 16
- Total Tokens: 4,657,819
- Cache Hit %: 99.1%
- Total USD: $1.8816
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 4,626
- cache_create_5m: 0
- cache_create_1h: 37,100
- cache_read: 4,598,383
- output: 17,710

## Model Mix

- claude-fable-5 (priced as claude-sonnet-4): 16 msgs (100%), $1.8816 (100%)

## Conversation Shape

- user_msg_count: 2
- user_msg_avg_len: 408
- turns_before_first_tool: 2
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 3

## Tool Usage

- Agent: 3
- Read: 1
- Edit: 1
- Bash: 1
- PowerShell: 1

## Tool Result Sizes (bytes)

- count: 7
- sum: 20,089
- p50: 3,080
- p90: 7,930
- max: 7,930

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Agent: 3 calls, 10,874B results, ~23,561 cache_create tok (2.17×)
- Bash: 1 calls, 251B results, ~11,295 cache_create tok (45×)
- Read: 1 calls, 820B results, ~949 cache_create tok (1.16×)
- Edit: 1 calls, 214B results, ~659 cache_create tok (3.08×)


## By Model (token detail)

### claude-fable-5 (priced as claude-sonnet-4)
- messages: 16
- usd: $1.8816
- input: 4,626
- cache_create_5m: 0
- cache_create_1h: 37,100
- cache_read: 4,598,383
- output: 17,710

