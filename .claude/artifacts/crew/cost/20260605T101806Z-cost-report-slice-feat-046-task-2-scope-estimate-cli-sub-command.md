---
kind: cost-report
run_title: "FEAT-046 Task 2 scope-estimate CLI sub-command"
usd: 14.6932
duration_ms: 324842
total_tokens: 7191066
cache_hit_pct: 99.1
source_project: C--work-mega-hero-crew
auto_detected: true
aggregate_all: false
source_count: 1
created_at: 2026-06-05T10:18:06.728Z
---

# Cost Report: FEAT-046 Task 2 scope-estimate CLI sub-command

- Created: 2026-06-05T10:18:06.728Z
- Run Title: FEAT-046 Task 2 scope-estimate CLI sub-command
- Window Start: 2026-06-05T10:12:40.108Z
- Window End: 2026-06-05T10:18:04.950Z
- Duration: 5.4 min (324842 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 46
- Total Tokens: 7,191,066
- Cache Hit %: 99.1%
- Total USD: $14.6932
- Source Project: C--work-mega-hero-crew
- Auto-detected: yes
- Aggregate All: no

## Tokens (totals)

- input: 56
- cache_create_5m: 0
- cache_create_1h: 61,832
- cache_read: 7,100,013
- output: 29,165

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 46 msgs (100%), $14.6932 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 1

## Tool Usage

- TaskUpdate: 14
- Bash: 13
- Read: 3
- Edit: 2
- Grep: 1
- Agent: 1
- ToolSearch: 1
- Write: 1

## Tool Result Sizes (bytes)

- count: 37
- sum: 18,944
- p50: 97
- p90: 1,954
- max: 2,581

## File Re-reads

- redundant_read_count: 1
- top paths:
  - 2× C:\work\mega\hero-crew\.claude\worktrees\feat-046-task-2-scope-estimate-cli\scripts\crew.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 13 calls, 10,596B results, ~21,103 cache_create tok (1.99×)
- TaskUpdate: 14 calls, 308B results, ~20,079 cache_create tok (65.19×)
- Agent: 1 calls, 2,581B results, ~8,046 cache_create tok (3.12×)
- Read: 3 calls, 4,285B results, ~5,299 cache_create tok (1.24×)
- Edit: 2 calls, 396B results, ~3,508 cache_create tok (8.86×)
- ToolSearch: 1 calls, 55B results, ~1,415 cache_create tok (25.73×)
- Write: 1 calls, 289B results, ~1,351 cache_create tok (4.67×)
- Grep: 1 calls, 143B results, ~471 cache_create tok (3.29×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 46
- usd: $14.6932
- input: 56
- cache_create_5m: 0
- cache_create_1h: 61,832
- cache_read: 7,100,013
- output: 29,165

