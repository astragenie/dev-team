---
kind: cost-report
run_title: "Brainstorming + writing-plans complete — spec + plan committed, awaiting execution choice"
usd: 889.9711
duration_ms: 454015776
total_tokens: 413612744
cache_hit_pct: 97.6
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-02T21:38:23.325Z
---

# Cost Report: Brainstorming + writing-plans complete — spec + plan committed, awaiting execution choice

- Created: 2026-06-02T21:38:23.325Z
- Run Title: Brainstorming + writing-plans complete — spec + plan committed, awaiting execution choice
- Window Start: 2026-05-28T15:31:27.373Z
- Window End: 2026-06-02T21:38:23.149Z
- Duration: 7566.9 min (454015776 ms)
- Sessions Scanned: 4
- Assistant Messages Counted: 1826
- Total Tokens: 413,612,744
- Cache Hit %: 97.6%
- Total USD: $889.9711
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 6,153
- cache_create_5m: 0
- cache_create_1h: 9,913,849
- cache_read: 401,871,176
- output: 1,821,566

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 1244 msgs (68.13%), $853.2308 (95.87%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 582 msgs (31.87%), $36.7402 (4.13%)

## Conversation Shape

- user_msg_count: 88
- user_msg_avg_len: 558
- turns_before_first_tool: 1
- compaction_count: 69
- skill_invocations: 6
- subagent_dispatches: 35

## Tool Usage

- Bash: 344 (14 failed)
- Edit: 214 (7 failed)
- Read: 180 (1 failed)
- TaskUpdate: 65
- Write: 49 (1 failed)
- TaskCreate: 39
- AskUserQuestion: 39 (3 failed)
- Grep: 36
- Agent: 35
- Glob: 19
- PowerShell: 10
- ToolSearch: 7
- Skill: 6

## Tool Result Sizes (bytes)

- count: 1044
- sum: 1,247,744
- p50: 192
- p90: 2,280
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

- Bash: 344 calls, 259,201B results, ~3,826,718 cache_create tok (14.76×)
- Edit: 214 calls, 36,868B results, ~1,557,252 cache_create tok (42.24×)
- TaskCreate: 39 calls, 2,581B results, ~1,507,257 cache_create tok (583.98×)
- Read: 180 calls, 820,395B results, ~1,014,313 cache_create tok (1.24×)
- AskUserQuestion: 39 calls, 8,314B results, ~396,044 cache_create tok (47.64×)
- TaskUpdate: 65 calls, 1,448B results, ~371,057 cache_create tok (256.25×)
- ToolSearch: 7 calls, 495B results, ~365,609 cache_create tok (738.6×)
- Agent: 35 calls, 55,525B results, ~304,223 cache_create tok (5.48×)
- Grep: 36 calls, 20,329B results, ~227,733 cache_create tok (11.2×)
- Write: 49 calls, 9,524B results, ~219,619 cache_create tok (23.06×)
- Skill: 6 calls, 252B results, ~46,700 cache_create tok (185.32×)
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
- messages: 1244
- usd: $853.2308
- input: 3,244
- cache_create_5m: 0
- cache_create_1h: 8,092,949
- cache_read: 340,109,782
- output: 1,336,387

