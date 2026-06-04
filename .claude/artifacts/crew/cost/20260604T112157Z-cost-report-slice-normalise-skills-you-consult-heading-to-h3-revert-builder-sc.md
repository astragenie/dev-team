---
kind: cost-report
run_title: "Normalise Skills-you-consult heading to H3 + revert builder scope-violation on validate-skills.mjs"
usd: 1091.3665
duration_ms: 589830034
total_tokens: 503939288
cache_hit_pct: 97.7
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-04T11:21:57.593Z
---

# Cost Report: Normalise Skills-you-consult heading to H3 + revert builder scope-violation on validate-skills.mjs

- Created: 2026-06-04T11:21:57.593Z
- Run Title: Normalise Skills-you-consult heading to H3 + revert builder scope-violation on validate-skills.mjs
- Window Start: 2026-05-28T15:31:27.373Z
- Window End: 2026-06-04T11:21:57.407Z
- Duration: 9830.5 min (589830034 ms)
- Sessions Scanned: 6
- Assistant Messages Counted: 2218
- Total Tokens: 503,939,288
- Cache Hit %: 97.7%
- Total USD: $1091.3665
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 8,499
- cache_create_5m: 0
- cache_create_1h: 11,300,765
- cache_read: 490,449,998
- output: 2,180,026

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 1636 msgs (73.76%), $1054.6262 (96.63%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 582 msgs (26.24%), $36.7402 (3.37%)

## Conversation Shape

- user_msg_count: 131
- user_msg_avg_len: 461
- turns_before_first_tool: 1
- compaction_count: 97
- skill_invocations: 9
- subagent_dispatches: 44

## Tool Usage

- Bash: 451 (16 failed)
- Edit: 240 (12 failed)
- Read: 202 (1 failed)
- TaskUpdate: 65
- Write: 60 (1 failed)
- Grep: 46
- Agent: 44
- AskUserQuestion: 43 (4 failed)
- TaskCreate: 39
- Glob: 23
- PowerShell: 10
- Skill: 9
- ToolSearch: 7

## Tool Result Sizes (bytes)

- count: 1240
- sum: 1,493,123
- p50: 209
- p90: 2,227
- max: 73,551

## File Re-reads

- redundant_read_count: 87
- top paths:
  - 10× C:\work\mega\hero-crew\scripts\crew.mjs
  - 10× C:\work\mega\hero-crew\scripts\lib\artifacts.mjs
  - 6× C:\work\mega\hero-crew\scripts\lib\session-cost.mjs
  - 6× C:\work\mega\hero-crew\scripts\lib\briefing\collect.mjs
  - 6× C:\work\mega\hero-crew\CHANGELOG.md

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 451 calls, 326,728B results, ~4,730,125 cache_create tok (14.48×)
- Edit: 240 calls, 41,129B results, ~1,592,967 cache_create tok (38.73×)
- TaskCreate: 39 calls, 2,581B results, ~1,507,257 cache_create tok (583.98×)
- Read: 202 calls, 963,027B results, ~1,151,938 cache_create tok (1.2×)
- AskUserQuestion: 43 calls, 9,604B results, ~485,357 cache_create tok (50.54×)
- Agent: 44 calls, 68,451B results, ~395,306 cache_create tok (5.78×)
- TaskUpdate: 65 calls, 1,448B results, ~371,057 cache_create tok (256.25×)
- ToolSearch: 7 calls, 495B results, ~365,609 cache_create tok (738.6×)
- Write: 60 calls, 11,750B results, ~294,323 cache_create tok (25.05×)
- Grep: 46 calls, 33,538B results, ~255,849 cache_create tok (7.63×)
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
- messages: 1636
- usd: $1054.6262
- input: 5,590
- cache_create_5m: 0
- cache_create_1h: 9,479,865
- cache_read: 428,688,604
- output: 1,694,847

