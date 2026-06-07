---
kind: cost-report
feature: FEAT-114
run_title: "FEAT114 SLICE38"
usd: 2.2867
duration_ms: 1989098
total_tokens: 4347969
cache_hit_pct: 97.1
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T13:34:23.634Z
---

# Cost Report: FEAT114 SLICE38

- Created: 2026-06-07T13:34:23.634Z
- Run Title: FEAT114 SLICE38
- Window Start: 2026-06-07T13:01:14.185Z
- Window End: 2026-06-07T13:34:23.283Z
- Duration: 33.2 min (1989098 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 34
- Total Tokens: 4,347,969
- Cache Hit %: 97.1%
- Total USD: $2.2867
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 46
- cache_create_5m: 0
- cache_create_1h: 126,246
- cache_read: 4,203,815
- output: 17,862

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 34 msgs (100%), $2.2867 (100%)

## Conversation Shape

- user_msg_count: 1
- user_msg_avg_len: 13179
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 6

## Tool Usage

- Bash: 12
- Agent: 6

## Tool Result Sizes (bytes)

- count: 19
- sum: 16,788
- p50: 470
- p90: 3,499
- max: 4,214

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 12 calls, 6,473B results, ~101,052 cache_create tok (15.61×)
- Agent: 6 calls, 9,794B results, ~24,714 cache_create tok (2.52×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 34
- usd: $2.2867
- input: 46
- cache_create_5m: 0
- cache_create_1h: 126,246
- cache_read: 4,203,815
- output: 17,862

