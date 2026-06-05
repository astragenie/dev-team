---
kind: cost-report
run_title: "FEAT-046 Task 2 scope-estimate CLI sub-command"
usd: 18.1793
duration_ms: 324842
total_tokens: 14264016
cache_hit_pct: 99.0
source_project: aggregate
aggregate_all: true
source_count: 3
created_at: 2026-06-05T10:18:08.955Z
---

# Cost Report: FEAT-046 Task 2 scope-estimate CLI sub-command

- Created: 2026-06-05T10:18:08.955Z
- Run Title: FEAT-046 Task 2 scope-estimate CLI sub-command
- Window Start: 2026-06-05T10:12:40.108Z
- Window End: 2026-06-05T10:18:04.950Z
- Duration: 5.4 min (324842 ms)
- Sessions Scanned: 3
- Assistant Messages Counted: 94
- Total Tokens: 14,264,016
- Cache Hit %: 99.0%
- Total USD: $18.1793
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-hero-crew: 47 msgs, $15.0168
- C--work-mega-loopobserver: 40 msgs, $2.5625
- C--work-mega-loop: 7 msgs, $0.6000

## Tokens (totals)

- input: 161
- cache_create_5m: 0
- cache_create_1h: 137,816
- cache_read: 14,051,161
- output: 74,878

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 47 msgs (50%), $15.0168 (82.6%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 47 msgs (50%), $3.1625 (17.4%)

## Conversation Shape

- user_msg_count: 2
- user_msg_avg_len: 17
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 4

## Tool Usage

- Bash: 28 (1 failed)
- TaskUpdate: 14
- Edit: 6
- Read: 5
- Agent: 4
- Grep: 2
- ToolSearch: 2
- Write: 2

## Tool Result Sizes (bytes)

- count: 60
- sum: 67,087
- p50: 198
- p90: 2,581
- max: 22,772

## File Re-reads

- redundant_read_count: 1
- top paths:
  - 2× C:\work\mega\hero-crew\.claude\worktrees\feat-046-task-2-scope-estimate-cli\scripts\crew.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 27 calls, 46,748B results, ~56,830 cache_create tok (1.22×)
- TaskUpdate: 14 calls, 308B results, ~21,534 cache_create tok (69.92×)
- Grep: 2 calls, 6,260B results, ~14,910 cache_create tok (2.38×)
- Agent: 1 calls, 2,581B results, ~11,596 cache_create tok (4.49×)
- Write: 2 calls, 550B results, ~11,003 cache_create tok (20.01×)
- Read: 5 calls, 9,058B results, ~8,468 cache_create tok (0.93×)
- Edit: 6 calls, 1,181B results, ~6,796 cache_create tok (5.75×)
- ToolSearch: 2 calls, 110B results, ~6,119 cache_create tok (55.63×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 47
- usd: $15.0168
- input: 100
- cache_create_5m: 0
- cache_create_1h: 63,287
- cache_read: 7,265,462
- output: 29,580

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 47
- usd: $3.1625
- input: 61
- cache_create_5m: 0
- cache_create_1h: 74,529
- cache_read: 6,785,699
- output: 45,298

