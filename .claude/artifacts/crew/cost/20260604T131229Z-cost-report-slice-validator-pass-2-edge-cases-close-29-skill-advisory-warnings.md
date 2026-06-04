---
kind: cost-report
run_title: "Validator Pass-2 edge cases + close 29 skill advisory warnings"
usd: 1190.463
duration_ms: 596461646
total_tokens: 551895636
cache_hit_pct: 97.9
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-04T13:12:29.222Z
---

# Cost Report: Validator Pass-2 edge cases + close 29 skill advisory warnings

- Created: 2026-06-04T13:12:29.222Z
- Run Title: Validator Pass-2 edge cases + close 29 skill advisory warnings
- Window Start: 2026-05-28T15:31:27.373Z
- Window End: 2026-06-04T13:12:29.019Z
- Duration: 9941.0 min (596461646 ms)
- Sessions Scanned: 6
- Assistant Messages Counted: 2371
- Total Tokens: 551,895,636
- Cache Hit %: 97.9%
- Total USD: $1190.4630
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 8,947
- cache_create_5m: 0
- cache_create_1h: 11,620,143
- cache_read: 537,840,892
- output: 2,425,654

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 1789 msgs (75.45%), $1153.7227 (96.91%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 582 msgs (24.55%), $36.7402 (3.09%)

## Conversation Shape

- user_msg_count: 145
- user_msg_avg_len: 445
- turns_before_first_tool: 1
- compaction_count: 108
- skill_invocations: 9
- subagent_dispatches: 54

## Tool Usage

- Bash: 489 (16 failed)
- Edit: 241 (12 failed)
- Read: 203 (1 failed)
- Write: 66 (1 failed)
- TaskUpdate: 65
- Agent: 54
- Grep: 50
- AskUserQuestion: 43 (4 failed)
- TaskCreate: 39
- Glob: 23
- PowerShell: 10
- Skill: 9
- ToolSearch: 7

## Tool Result Sizes (bytes)

- count: 1300
- sum: 1,564,825
- p50: 211
- p90: 2,263
- max: 73,551

## File Re-reads

- redundant_read_count: 88
- top paths:
  - 10× C:\work\mega\hero-crew\scripts\crew.mjs
  - 10× C:\work\mega\hero-crew\scripts\lib\artifacts.mjs
  - 6× C:\work\mega\hero-crew\scripts\lib\session-cost.mjs
  - 6× C:\work\mega\hero-crew\scripts\lib\briefing\collect.mjs
  - 6× C:\work\mega\hero-crew\CHANGELOG.md

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 489 calls, 364,134B results, ~4,873,949 cache_create tok (13.39×)
- Edit: 241 calls, 41,279B results, ~1,594,328 cache_create tok (38.62×)
- TaskCreate: 39 calls, 2,581B results, ~1,507,257 cache_create tok (583.98×)
- Read: 203 calls, 965,233B results, ~1,154,278 cache_create tok (1.2×)
- Agent: 54 calls, 95,814B results, ~501,864 cache_create tok (5.24×)
- AskUserQuestion: 43 calls, 9,604B results, ~485,357 cache_create tok (50.54×)
- TaskUpdate: 65 calls, 1,448B results, ~371,057 cache_create tok (256.25×)
- ToolSearch: 7 calls, 495B results, ~365,609 cache_create tok (738.6×)
- Write: 66 calls, 12,939B results, ~350,715 cache_create tok (27.11×)
- Grep: 50 calls, 36,926B results, ~264,752 cache_create tok (7.17×)
- Skill: 9 calls, 404B results, ~71,534 cache_create tok (177.06×)
- Glob: 23 calls, 6,984B results, ~40,985 cache_create tok (5.87×)
- PowerShell: 10 calls, 25,388B results, ~36,982 cache_create tok (1.46×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 582
- usd: $36.7402
- input: 2,909
- cache_create_5m: 0
- cache_create_1h: 1,820,900
- cache_read: 61,761,394
- output: 485,179

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 1789
- usd: $1153.7227
- input: 6,038
- cache_create_5m: 0
- cache_create_1h: 9,799,243
- cache_read: 476,079,498
- output: 1,940,475

