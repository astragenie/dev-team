---
kind: cost-report
run_title: "Cross-repo retrospective + cost-efficiency + cost-advise analysis arc"
usd: 796.9916
duration_ms: 434126347
total_tokens: 378830193
cache_hit_pct: 97.7
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-02T16:06:53.895Z
---

# Cost Report: Cross-repo retrospective + cost-efficiency + cost-advise analysis arc

- Created: 2026-06-02T16:06:53.895Z
- Run Title: Cross-repo retrospective + cost-efficiency + cost-advise analysis arc
- Window Start: 2026-05-28T15:31:27.373Z
- Window End: 2026-06-02T16:06:53.720Z
- Duration: 7235.4 min (434126347 ms)
- Sessions Scanned: 4
- Assistant Messages Counted: 1766
- Total Tokens: 378,830,193
- Cache Hit %: 97.7%
- Total USD: $796.9916
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 6,021
- cache_create_5m: 0
- cache_create_1h: 8,720,745
- cache_read: 368,374,383
- output: 1,729,044

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 1184 msgs (67.04%), $760.2514 (95.39%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 582 msgs (32.96%), $36.7402 (4.61%)

## Conversation Shape

- user_msg_count: 85
- user_msg_avg_len: 576
- turns_before_first_tool: 1
- compaction_count: 65
- skill_invocations: 5
- subagent_dispatches: 35

## Tool Usage

- Bash: 333 (14 failed)
- Edit: 213 (7 failed)
- Read: 180 (1 failed)
- TaskUpdate: 65
- Write: 46 (1 failed)
- TaskCreate: 39
- Grep: 36
- Agent: 35
- AskUserQuestion: 32 (2 failed)
- Glob: 19
- PowerShell: 10
- ToolSearch: 7
- Skill: 5

## Tool Result Sizes (bytes)

- count: 1021
- sum: 1,239,517
- p50: 192
- p90: 2,378
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

- Bash: 333 calls, 253,587B results, ~2,714,443 cache_create tok (10.7×)
- Edit: 213 calls, 36,664B results, ~1,556,078 cache_create tok (42.44×)
- TaskCreate: 39 calls, 2,581B results, ~1,507,257 cache_create tok (583.98×)
- Read: 180 calls, 820,395B results, ~1,014,313 cache_create tok (1.24×)
- AskUserQuestion: 32 calls, 6,570B results, ~376,137 cache_create tok (57.25×)
- TaskUpdate: 65 calls, 1,448B results, ~371,057 cache_create tok (256.25×)
- ToolSearch: 7 calls, 495B results, ~365,609 cache_create tok (738.6×)
- Agent: 35 calls, 55,525B results, ~304,223 cache_create tok (5.48×)
- Grep: 36 calls, 20,329B results, ~227,733 cache_create tok (11.2×)
- Write: 46 calls, 8,901B results, ~166,726 cache_create tok (18.73×)
- Skill: 5 calls, 210B results, ~39,845 cache_create tok (189.74×)
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
- messages: 1184
- usd: $760.2514
- input: 3,112
- cache_create_5m: 0
- cache_create_1h: 6,899,845
- cache_read: 306,612,989
- output: 1,243,865

