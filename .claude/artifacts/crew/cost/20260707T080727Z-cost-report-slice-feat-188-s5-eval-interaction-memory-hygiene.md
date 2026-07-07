---
kind: cost-report
run_title: "FEAT-188 S5 — eval interaction + memory hygiene"
usd: 4026.6668
duration_ms: 679420503
total_tokens: 1972987758
cache_hit_pct: 98.6
source_project: C--work-mega-dev-team
aggregate_all: false
source_count: 1
created_at: 2026-07-07T08:07:27.779Z
---

# Cost Report: FEAT-188 S5 — eval interaction + memory hygiene

- Created: 2026-07-07T08:07:27.779Z
- Run Title: FEAT-188 S5 — eval interaction + memory hygiene
- Window Start: 2026-06-29T11:23:46.873Z
- Window End: 2026-07-07T08:07:27.376Z
- Duration: 11323.7 min (679420503 ms)
- Sessions Scanned: 12
- Assistant Messages Counted: 6532
- Total Tokens: 1,972,987,758
- Cache Hit %: 98.6%
- Total USD: $4026.6668
- Source Project: C--work-mega-dev-team
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 1,759,862
- cache_create_5m: 0
- cache_create_1h: 25,007,005
- cache_read: 1,939,942,350
- output: 6,278,541

## Model Mix

- claude-opus-4-8 (priced as claude-opus-4): 3368 msgs (51.56%), $2355.9972 (58.51%)
- claude-opus-4-7 (priced as claude-opus-4): 2765 msgs (42.33%), $1637.9832 (40.68%)
- claude-fable-5 (priced as claude-sonnet-4): 399 msgs (6.11%), $32.6864 (0.81%)

## Conversation Shape

- user_msg_count: 435
- user_msg_avg_len: 1265
- turns_before_first_tool: 4
- compaction_count: 88
- skill_invocations: 2
- subagent_dispatches: 115

## Tool Usage

- Bash: 1618 (26 failed)
- Edit: 461 (24 failed)
- Read: 359
- TaskUpdate: 132
- Agent: 115
- Write: 107 (1 failed)
- Grep: 75 (3 failed)
- TaskCreate: 74
- ToolSearch: 40
- SendMessage: 35
- PowerShell: 26 (4 failed)
- AskUserQuestion: 15 (4 failed)
- Glob: 15
- mcp__plugin_astramem_astramem__remember: 11 (2 failed)
- mcp__plugin_astramem_astramem__recall_memory: 5
- TaskList: 4
- mcp__plugin_astramem_astramem__get_health: 2
- Skill: 2
- TaskOutput: 1 (1 failed)
- mcp__plugin_astramem_astramem__erase_memory: 1
- EnterWorktree: 1
- Monitor: 1
- ExitWorktree: 1
- mcp__plugin_astramem_astramem__session_digest: 1
- TaskStop: 1 (1 failed)
- ScheduleWakeup: 1

## Tool Result Sizes (bytes)

- count: 3124
- sum: 2,909,706
- p50: 253
- p90: 2,183
- max: 49,395

## File Re-reads

- redundant_read_count: 146
- top paths:
  - 11× C:\work\mega\dev-team\CHANGELOG.md
  - 9× C:\work\mega\dev-team\scripts\crew.ts
  - 6× C:\work\mega\dev-team-auto\agents\refactor.md
  - 6× C:\work\mega\dev-team\scripts\lib\gepa\auto-pr.ts
  - 6× C:\work\mega\dev-team\evals\lib\run-eval.ts

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 1624 calls, 1,314,406B results, ~12,736,844 cache_create tok (9.69×)
- Read: 367 calls, 1,126,910B results, ~3,310,017 cache_create tok (2.94×)
- ToolSearch: 40 calls, 4,058B results, ~1,802,292 cache_create tok (444.13×)
- TaskCreate: 74 calls, 5,453B results, ~1,450,924 cache_create tok (266.08×)
- TaskUpdate: 132 calls, 3,207B results, ~1,178,023 cache_create tok (367.33×)
- Agent: 118 calls, 166,174B results, ~1,120,738 cache_create tok (6.74×)
- Edit: 462 calls, 79,282B results, ~894,059 cache_create tok (11.28×)
- SendMessage: 35 calls, 13,744B results, ~556,354 cache_create tok (40.48×)
- Write: 108 calls, 19,038B results, ~539,318 cache_create tok (28.33×)
- PowerShell: 26 calls, 25,487B results, ~498,837 cache_create tok (19.57×)
- Glob: 15 calls, 14,300B results, ~361,447 cache_create tok (25.28×)
- Grep: 75 calls, 89,266B results, ~148,011 cache_create tok (1.66×)
- mcp__plugin_astramem_astramem__remember: 11 calls, 908B results, ~137,606 cache_create tok (151.55×)
- AskUserQuestion: 15 calls, 6,775B results, ~112,914 cache_create tok (16.67×)
- mcp__plugin_astramem_astramem__recall_memory: 5 calls, 22,010B results, ~36,582 cache_create tok (1.66×)
- Skill: 2 calls, 59B results, ~21,126 cache_create tok (358.07×)
- TaskList: 4 calls, 750B results, ~16,694 cache_create tok (22.26×)
- mcp__plugin_astramem_astramem__session_digest: 1 calls, 1,133B results, ~2,520 cache_create tok (2.22×)
- Monitor: 1 calls, 208B results, ~2,202 cache_create tok (10.59×)
- mcp__plugin_astramem_astramem__get_health: 2 calls, 124B results, ~1,759 cache_create tok (14.19×)
- TaskStop: 1 calls, 82B results, ~1,482 cache_create tok (18.07×)
- mcp__plugin_astramem_astramem__erase_memory: 1 calls, 88B results, ~1,426 cache_create tok (16.2×)
- ScheduleWakeup: 1 calls, 157B results, ~1,372 cache_create tok (8.74×)
- ExitWorktree: 1 calls, 160B results, ~329 cache_create tok (2.06×)
- EnterWorktree: 1 calls, 246B results, ~233 cache_create tok (0.95×)
- TaskOutput: 1 calls, 81B results, ~156 cache_create tok (1.93×)


## By Model (token detail)

### claude-opus-4-8 (priced as claude-opus-4)
- messages: 3368
- usd: $2355.9972
- input: 1,578,356
- cache_create_5m: 0
- cache_create_1h: 11,613,003
- cache_read: 1,108,911,631
- output: 4,274,191

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 2765
- usd: $1637.9832
- input: 8,213
- cache_create_5m: 0
- cache_create_1h: 12,443,712
- cache_read: 758,413,947
- output: 1,692,370

### claude-fable-5 (priced as claude-sonnet-4)
- messages: 399
- usd: $32.6864
- input: 173,293
- cache_create_5m: 0
- cache_create_1h: 950,290
- cache_read: 72,616,772
- output: 311,980

