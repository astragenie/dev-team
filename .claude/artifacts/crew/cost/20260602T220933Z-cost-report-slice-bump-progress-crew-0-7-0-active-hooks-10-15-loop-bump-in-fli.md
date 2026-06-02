---
kind: cost-report
run_title: "Bump progress: crew@0.7.0 active (hooks 10→15), loop bump in-flight"
usd: 959.7097
duration_ms: 455885899
total_tokens: 453692702
cache_hit_pct: 97.8
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-02T22:09:33.449Z
---

# Cost Report: Bump progress: crew@0.7.0 active (hooks 10→15), loop bump in-flight

- Created: 2026-06-02T22:09:33.449Z
- Run Title: Bump progress: crew@0.7.0 active (hooks 10→15), loop bump in-flight
- Window Start: 2026-05-28T15:31:27.373Z
- Window End: 2026-06-02T22:09:33.272Z
- Duration: 7598.1 min (455885899 ms)
- Sessions Scanned: 4
- Assistant Messages Counted: 1889
- Total Tokens: 453,692,702
- Cache Hit %: 97.8%
- Total USD: $959.7097
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 6,310
- cache_create_5m: 0
- cache_create_1h: 10,066,013
- cache_read: 441,726,977
- output: 1,893,402

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 1307 msgs (69.19%), $922.9695 (96.17%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 582 msgs (30.81%), $36.7402 (3.83%)

## Conversation Shape

- user_msg_count: 101
- user_msg_avg_len: 516
- turns_before_first_tool: 1
- compaction_count: 78
- skill_invocations: 8
- subagent_dispatches: 38

## Tool Usage

- Bash: 357 (14 failed)
- Edit: 216 (8 failed)
- Read: 181 (1 failed)
- TaskUpdate: 65
- Write: 51 (1 failed)
- AskUserQuestion: 42 (3 failed)
- TaskCreate: 39
- Agent: 38
- Grep: 36
- Glob: 19
- PowerShell: 10
- Skill: 8
- ToolSearch: 7

## Tool Result Sizes (bytes)

- count: 1070
- sum: 1,260,187
- p50: 192
- p90: 2,264
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

- Bash: 357 calls, 265,616B results, ~3,808,586 cache_create tok (14.34×)
- Edit: 216 calls, 37,141B results, ~1,559,128 cache_create tok (41.98×)
- TaskCreate: 39 calls, 2,581B results, ~1,507,257 cache_create tok (583.98×)
- Read: 181 calls, 821,478B results, ~1,014,915 cache_create tok (1.24×)
- AskUserQuestion: 42 calls, 8,841B results, ~410,250 cache_create tok (46.4×)
- TaskUpdate: 65 calls, 1,448B results, ~371,057 cache_create tok (256.25×)
- ToolSearch: 7 calls, 495B results, ~365,609 cache_create tok (738.6×)
- Agent: 38 calls, 59,092B results, ~347,333 cache_create tok (5.88×)
- Write: 51 calls, 9,987B results, ~306,004 cache_create tok (30.64×)
- Grep: 36 calls, 20,329B results, ~227,733 cache_create tok (11.2×)
- Skill: 8 calls, 367B results, ~70,817 cache_create tok (192.96×)
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
- messages: 1307
- usd: $922.9695
- input: 3,401
- cache_create_5m: 0
- cache_create_1h: 8,245,113
- cache_read: 379,965,583
- output: 1,408,223

