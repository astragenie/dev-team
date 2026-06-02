---
kind: cost-report
run_title: "Consumer bump runbook + cost-hotspot investigation shipped"
usd: 914.1826
duration_ms: 454868235
total_tokens: 426590104
cache_hit_pct: 97.7
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-02T21:52:35.796Z
---

# Cost Report: Consumer bump runbook + cost-hotspot investigation shipped

- Created: 2026-06-02T21:52:35.796Z
- Run Title: Consumer bump runbook + cost-hotspot investigation shipped
- Window Start: 2026-05-28T15:31:27.373Z
- Window End: 2026-06-02T21:52:35.608Z
- Duration: 7581.1 min (454868235 ms)
- Sessions Scanned: 4
- Assistant Messages Counted: 1847
- Total Tokens: 426,590,104
- Cache Hit %: 97.7%
- Total USD: $914.1826
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 6,186
- cache_create_5m: 0
- cache_create_1h: 9,962,901
- cache_read: 414,753,913
- output: 1,867,104

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 1265 msgs (68.49%), $877.4423 (95.98%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 582 msgs (31.51%), $36.7402 (4.02%)

## Conversation Shape

- user_msg_count: 88
- user_msg_avg_len: 558
- turns_before_first_tool: 1
- compaction_count: 70
- skill_invocations: 7
- subagent_dispatches: 38

## Tool Usage

- Bash: 348 (14 failed)
- Edit: 214 (7 failed)
- Read: 180 (1 failed)
- TaskUpdate: 65
- Write: 49 (1 failed)
- AskUserQuestion: 40 (3 failed)
- TaskCreate: 39
- Agent: 38
- Grep: 36
- Glob: 19
- PowerShell: 10
- ToolSearch: 7
- Skill: 7

## Tool Result Sizes (bytes)

- count: 1052
- sum: 1,253,407
- p50: 192
- p90: 2,276
- max: 73,551

## File Re-reads

- redundant_read_count: 73
- top paths:
  - 10× C:\work\mega\hero-crew\scripts\crew.mjs
  - 10× C:\work\mega\hero-crew\scripts\lib\artifacts.mjs
  - 6× C:\work\mega\hero-crew\scripts\lib\session-cost.mjs
  - 6× C:\work\mega\hero-crew\CHANGELOG.md
  - 5× C:\work\mega\hero-crew\scripts\lib\briefing\collect.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 348 calls, 261,797B results, ~3,760,494 cache_create tok (14.36×)
- Edit: 214 calls, 36,868B results, ~1,557,252 cache_create tok (42.24×)
- TaskCreate: 39 calls, 2,581B results, ~1,507,257 cache_create tok (583.98×)
- Read: 180 calls, 820,395B results, ~1,014,313 cache_create tok (1.24×)
- Agent: 37 calls, 58,367B results, ~401,397 cache_create tok (6.88×)
- AskUserQuestion: 40 calls, 8,483B results, ~399,332 cache_create tok (47.07×)
- TaskUpdate: 65 calls, 1,448B results, ~371,057 cache_create tok (256.25×)
- ToolSearch: 7 calls, 495B results, ~365,609 cache_create tok (738.6×)
- Grep: 36 calls, 20,329B results, ~227,733 cache_create tok (11.2×)
- Write: 49 calls, 9,524B results, ~219,619 cache_create tok (23.06×)
- Skill: 7 calls, 308B results, ~61,514 cache_create tok (199.72×)
- Glob: 19 calls, 5,828B results, ~38,866 cache_create tok (6.67×)
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
- messages: 1265
- usd: $877.4423
- input: 3,277
- cache_create_5m: 0
- cache_create_1h: 8,142,001
- cache_read: 352,992,519
- output: 1,381,925

