---
kind: cost-report
run_title: "Brainstorming session — consumer bump + investigation design (mid-flight)"
usd: 859.525
duration_ms: 452970576
total_tokens: 397600238
cache_hit_pct: 97.5
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-02T21:20:58.137Z
---

# Cost Report: Brainstorming session — consumer bump + investigation design (mid-flight)

- Created: 2026-06-02T21:20:58.137Z
- Run Title: Brainstorming session — consumer bump + investigation design (mid-flight)
- Window Start: 2026-05-28T15:31:27.373Z
- Window End: 2026-06-02T21:20:57.949Z
- Duration: 7549.5 min (452970576 ms)
- Sessions Scanned: 4
- Assistant Messages Counted: 1799
- Total Tokens: 397,600,238
- Cache Hit %: 97.5%
- Total USD: $859.5250
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 6,089
- cache_create_5m: 0
- cache_create_1h: 9,845,399
- cache_read: 385,988,076
- output: 1,760,674

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 1217 msgs (67.65%), $822.7848 (95.73%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 582 msgs (32.35%), $36.7402 (4.27%)

## Conversation Shape

- user_msg_count: 87
- user_msg_avg_len: 565
- turns_before_first_tool: 1
- compaction_count: 67
- skill_invocations: 5
- subagent_dispatches: 35

## Tool Usage

- Bash: 340 (14 failed)
- Edit: 213 (7 failed)
- Read: 180 (1 failed)
- TaskUpdate: 65
- Write: 47 (1 failed)
- TaskCreate: 39
- AskUserQuestion: 36 (2 failed)
- Grep: 36
- Agent: 35
- Glob: 19
- PowerShell: 10
- ToolSearch: 7
- Skill: 5

## Tool Result Sizes (bytes)

- count: 1032
- sum: 1,243,265
- p50: 192
- p90: 2,371
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

- Bash: 339 calls, 256,454B results, ~3,821,583 cache_create tok (14.9×)
- Edit: 213 calls, 36,664B results, ~1,556,078 cache_create tok (42.44×)
- TaskCreate: 39 calls, 2,581B results, ~1,507,257 cache_create tok (583.98×)
- Read: 180 calls, 820,395B results, ~1,014,313 cache_create tok (1.24×)
- AskUserQuestion: 36 calls, 7,209B results, ~391,038 cache_create tok (54.24×)
- TaskUpdate: 65 calls, 1,448B results, ~371,057 cache_create tok (256.25×)
- ToolSearch: 7 calls, 495B results, ~365,609 cache_create tok (738.6×)
- Agent: 35 calls, 55,525B results, ~304,223 cache_create tok (5.48×)
- Grep: 36 calls, 20,329B results, ~227,733 cache_create tok (11.2×)
- Write: 47 calls, 9,143B results, ~169,339 cache_create tok (18.52×)
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
- messages: 1217
- usd: $822.7848
- input: 3,180
- cache_create_5m: 0
- cache_create_1h: 8,024,499
- cache_read: 324,226,682
- output: 1,275,495

