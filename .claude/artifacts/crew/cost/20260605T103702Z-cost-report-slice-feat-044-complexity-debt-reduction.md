---
kind: cost-report
run_title: "FEAT-044 complexity debt reduction"
usd: 144.6757
duration_ms: 2498977
total_tokens: 97196365
cache_hit_pct: 98.0
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-05T10:37:02.026Z
---

# Cost Report: FEAT-044 complexity debt reduction

- Created: 2026-06-05T10:37:02.026Z
- Run Title: FEAT-044 complexity debt reduction
- Window Start: 2026-06-05T09:55:22.780Z
- Window End: 2026-06-05T10:37:01.757Z
- Duration: 41.6 min (2498977 ms)
- Sessions Scanned: 3
- Assistant Messages Counted: 648
- Total Tokens: 97,196,365
- Cache Hit %: 98.0%
- Total USD: $144.6757
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 1,031
- cache_create_5m: 0
- cache_create_1h: 1,935,318
- cache_read: 94,889,537
- output: 370,479

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 260 msgs (40.12%), $123.7958 (85.57%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 388 msgs (59.88%), $20.8799 (14.43%)

## Conversation Shape

- user_msg_count: 13
- user_msg_avg_len: 2170
- turns_before_first_tool: 1
- compaction_count: 101
- skill_invocations: 0
- subagent_dispatches: 6

## Tool Usage

- Bash: 185 (6 failed)
- Read: 52
- TaskUpdate: 30
- Edit: 26 (1 failed)
- TaskCreate: 15
- Grep: 14
- Write: 9 (1 failed)
- Agent: 6
- ToolSearch: 4
- Glob: 3
- EnterWorktree: 2
- ExitWorktree: 2 (1 failed)

## Tool Result Sizes (bytes)

- count: 350
- sum: 316,812
- p50: 199
- p90: 1,859
- max: 60,229

## File Re-reads

- redundant_read_count: 34
- top paths:
  - 9× C:\work\mega\hero-crew\scripts\crew.mjs
  - 9× C:\work\mega\hero-crew\scripts\lib\workflow-state.mjs
  - 5× C:\work\mega\hero-crew\scripts\lib\briefing\collect.mjs
  - 4× C:\work\mega\hero-crew\scripts\lib\cost-hygiene\cost-slice-handler.mjs
  - 4× C:\work\mega\hero-crew\scripts\lib\cost-advisor.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 185 calls, 78,727B results, ~1,056,297 cache_create tok (13.42×)
- Glob: 3 calls, 78B results, ~318,069 cache_create tok (4077.81×)
- Read: 52 calls, 210,135B results, ~256,163 cache_create tok (1.22×)
- Agent: 6 calls, 11,245B results, ~47,469 cache_create tok (4.22×)
- TaskUpdate: 30 calls, 672B results, ~44,681 cache_create tok (66.49×)
- Edit: 26 calls, 4,506B results, ~41,001 cache_create tok (9.1×)
- Write: 9 calls, 1,723B results, ~27,763 cache_create tok (16.11×)
- Grep: 14 calls, 6,954B results, ~20,109 cache_create tok (2.89×)
- TaskCreate: 15 calls, 949B results, ~7,987 cache_create tok (8.42×)
- ToolSearch: 4 calls, 267B results, ~6,516 cache_create tok (24.4×)
- EnterWorktree: 2 calls, 534B results, ~850 cache_create tok (1.59×)
- ExitWorktree: 2 calls, 465B results, ~595 cache_create tok (1.28×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 260
- usd: $123.7958
- input: 514
- cache_create_5m: 0
- cache_create_1h: 1,420,297
- cache_read: 45,126,878
- output: 179,852

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 388
- usd: $20.8799
- input: 517
- cache_create_5m: 0
- cache_create_1h: 515,021
- cache_read: 49,762,659
- output: 190,627

