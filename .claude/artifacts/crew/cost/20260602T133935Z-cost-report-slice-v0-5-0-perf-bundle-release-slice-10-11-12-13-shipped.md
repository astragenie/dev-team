---
kind: cost-report
slice: SLICE-10
run_title: "v0.5.0 perf bundle release — SLICE-10/11/12/13 shipped"
usd: 581.0157
duration_ms: 425288183
total_tokens: 278058673
cache_hit_pct: 97.5
review_decision: rejected
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-02T13:39:35.736Z
---

# Cost Report: v0.5.0 perf bundle release — SLICE-10/11/12/13 shipped

- Created: 2026-06-02T13:39:35.736Z
- Run Title: v0.5.0 perf bundle release — SLICE-10/11/12/13 shipped
- Window Start: 2026-05-28T15:31:27.373Z
- Window End: 2026-06-02T13:39:35.556Z
- Duration: 7088.1 min (425288183 ms)
- Sessions Scanned: 4
- Assistant Messages Counted: 1557
- Total Tokens: 278,058,673
- Cache Hit %: 97.5%
- Total USD: $581.0157
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Outcome Linkage

- Slice: SLICE-10
- Grade Avg: -
- Review Decision: rejected
- Validation Decision: -

## Tokens (totals)

- input: 5,669
- cache_create_5m: 0
- cache_create_1h: 6,973,607
- cache_read: 269,554,713
- output: 1,524,684

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 975 msgs (62.62%), $544.2755 (93.68%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 582 msgs (37.38%), $36.7402 (6.32%)

## Conversation Shape

- user_msg_count: 77
- user_msg_avg_len: 628
- turns_before_first_tool: 1
- compaction_count: 61
- skill_invocations: 5
- subagent_dispatches: 35

## Tool Usage

- Bash: 283 (13 failed)
- Edit: 185 (7 failed)
- Read: 159 (1 failed)
- TaskUpdate: 65
- TaskCreate: 39
- Agent: 35
- Grep: 35
- Write: 31
- AskUserQuestion: 27 (2 failed)
- Glob: 19
- PowerShell: 10
- ToolSearch: 7
- Skill: 5

## Tool Result Sizes (bytes)

- count: 901
- sum: 1,165,334
- p50: 192
- p90: 2,469
- max: 73,551

## File Re-reads

- redundant_read_count: 67
- top paths:
  - 10× C:\work\mega\hero-crew\scripts\crew.mjs
  - 10× C:\work\mega\hero-crew\scripts\lib\artifacts.mjs
  - 6× C:\work\mega\hero-crew\scripts\lib\session-cost.mjs
  - 6× C:\work\mega\hero-crew\CHANGELOG.md
  - 5× C:\work\mega\hero-crew\scripts\lib\briefing\collect.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 283 calls, 217,097B results, ~1,544,686 cache_create tok (7.12×)
- TaskCreate: 39 calls, 2,581B results, ~1,507,257 cache_create tok (583.98×)
- Edit: 185 calls, 32,459B results, ~1,082,520 cache_create tok (33.35×)
- Read: 159 calls, 790,816B results, ~973,711 cache_create tok (1.23×)
- TaskUpdate: 65 calls, 1,448B results, ~371,057 cache_create tok (256.25×)
- ToolSearch: 7 calls, 495B results, ~365,609 cache_create tok (738.6×)
- AskUserQuestion: 27 calls, 5,784B results, ~357,006 cache_create tok (61.72×)
- Agent: 35 calls, 55,525B results, ~304,223 cache_create tok (5.48×)
- Grep: 35 calls, 19,847B results, ~226,951 cache_create tok (11.44×)
- Write: 31 calls, 6,260B results, ~123,418 cache_create tok (19.72×)
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
- messages: 975
- usd: $544.2755
- input: 2,760
- cache_create_5m: 0
- cache_create_1h: 5,152,707
- cache_read: 207,793,319
- output: 1,039,505

