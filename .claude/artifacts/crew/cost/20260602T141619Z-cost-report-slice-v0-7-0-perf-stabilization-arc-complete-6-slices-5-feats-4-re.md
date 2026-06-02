---
kind: cost-report
run_title: "v0.7.0 perf-stabilization arc complete — 6 slices, 5 FEATs, 4 releases"
usd: 688.9322
duration_ms: 427491849
total_tokens: 333940179
cache_hit_pct: 97.7
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-02T14:16:19.397Z
---

# Cost Report: v0.7.0 perf-stabilization arc complete — 6 slices, 5 FEATs, 4 releases

- Created: 2026-06-02T14:16:19.397Z
- Run Title: v0.7.0 perf-stabilization arc complete — 6 slices, 5 FEATs, 4 releases
- Window Start: 2026-05-28T15:31:27.373Z
- Window End: 2026-06-02T14:16:19.222Z
- Duration: 7124.9 min (427491849 ms)
- Sessions Scanned: 4
- Assistant Messages Counted: 1680
- Total Tokens: 333,940,179
- Cache Hit %: 97.7%
- Total USD: $688.9322
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 5,842
- cache_create_5m: 0
- cache_create_1h: 7,540,283
- cache_read: 324,761,320
- output: 1,632,734

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 1098 msgs (65.36%), $652.1920 (94.67%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 582 msgs (34.64%), $36.7402 (5.33%)

## Conversation Shape

- user_msg_count: 79
- user_msg_avg_len: 615
- turns_before_first_tool: 1
- compaction_count: 62
- skill_invocations: 5
- subagent_dispatches: 35

## Tool Usage

- Bash: 308 (14 failed)
- Edit: 213 (7 failed)
- Read: 172 (1 failed)
- TaskUpdate: 65
- TaskCreate: 39
- Write: 37
- Grep: 36
- Agent: 35
- AskUserQuestion: 31 (2 failed)
- Glob: 19
- PowerShell: 10
- ToolSearch: 7
- Skill: 5

## Tool Result Sizes (bytes)

- count: 978
- sum: 1,210,047
- p50: 186
- p90: 2,395
- max: 73,551

## File Re-reads

- redundant_read_count: 72
- top paths:
  - 10× C:\work\mega\hero-crew\scripts\crew.mjs
  - 10× C:\work\mega\hero-crew\scripts\lib\artifacts.mjs
  - 6× C:\work\mega\hero-crew\scripts\lib\session-cost.mjs
  - 6× C:\work\mega\hero-crew\CHANGELOG.md
  - 5× C:\work\mega\hero-crew\scripts\lib\briefing\collect.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 308 calls, 229,849B results, ~1,575,417 cache_create tok (6.85×)
- Edit: 213 calls, 36,664B results, ~1,556,078 cache_create tok (42.44×)
- TaskCreate: 39 calls, 2,581B results, ~1,507,257 cache_create tok (583.98×)
- Read: 172 calls, 816,428B results, ~998,132 cache_create tok (1.22×)
- AskUserQuestion: 31 calls, 6,431B results, ~373,281 cache_create tok (58.04×)
- TaskUpdate: 65 calls, 1,448B results, ~371,057 cache_create tok (256.25×)
- ToolSearch: 7 calls, 495B results, ~365,609 cache_create tok (738.6×)
- Agent: 35 calls, 55,525B results, ~304,223 cache_create tok (5.48×)
- Grep: 36 calls, 20,329B results, ~227,733 cache_create tok (11.2×)
- Write: 37 calls, 7,275B results, ~144,327 cache_create tok (19.84×)
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
- messages: 1098
- usd: $652.1920
- input: 2,933
- cache_create_5m: 0
- cache_create_1h: 5,719,383
- cache_read: 262,999,926
- output: 1,147,555

