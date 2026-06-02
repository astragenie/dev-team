---
kind: cost-report
run_title: "Bump runbook mid-flight — syntax fix pushed, awaiting user marketplace-add keystroke"
usd: 946.4327
duration_ms: 455655622
total_tokens: 446333202
cache_hit_pct: 97.7
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-02T22:05:43.173Z
---

# Cost Report: Bump runbook mid-flight — syntax fix pushed, awaiting user marketplace-add keystroke

- Created: 2026-06-02T22:05:43.173Z
- Run Title: Bump runbook mid-flight — syntax fix pushed, awaiting user marketplace-add keystroke
- Window Start: 2026-05-28T15:31:27.373Z
- Window End: 2026-06-02T22:05:42.995Z
- Duration: 7594.3 min (455655622 ms)
- Sessions Scanned: 4
- Assistant Messages Counted: 1878
- Total Tokens: 446,333,202
- Cache Hit %: 97.7%
- Total USD: $946.4327
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 6,274
- cache_create_5m: 0
- cache_create_1h: 10,009,431
- cache_read: 434,432,594
- output: 1,884,903

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 1296 msgs (69.01%), $909.6925 (96.12%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 582 msgs (30.99%), $36.7402 (3.88%)

## Conversation Shape

- user_msg_count: 93
- user_msg_avg_len: 552
- turns_before_first_tool: 1
- compaction_count: 73
- skill_invocations: 8
- subagent_dispatches: 38

## Tool Usage

- Bash: 354 (14 failed)
- Edit: 216 (8 failed)
- Read: 181 (1 failed)
- TaskUpdate: 65
- Write: 50 (1 failed)
- AskUserQuestion: 41 (3 failed)
- TaskCreate: 39
- Agent: 38
- Grep: 36
- Glob: 19
- PowerShell: 10
- Skill: 8
- ToolSearch: 7

## Tool Result Sizes (bytes)

- count: 1065
- sum: 1,257,507
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

- Bash: 354 calls, 263,404B results, ~3,769,085 cache_create tok (14.31×)
- Edit: 216 calls, 37,141B results, ~1,559,128 cache_create tok (41.98×)
- TaskCreate: 39 calls, 2,581B results, ~1,507,257 cache_create tok (583.98×)
- Read: 181 calls, 821,478B results, ~1,014,915 cache_create tok (1.24×)
- AskUserQuestion: 41 calls, 8,612B results, ~406,212 cache_create tok (47.17×)
- TaskUpdate: 65 calls, 1,448B results, ~371,057 cache_create tok (256.25×)
- ToolSearch: 7 calls, 495B results, ~365,609 cache_create tok (738.6×)
- Agent: 38 calls, 59,092B results, ~347,333 cache_create tok (5.88×)
- Write: 50 calls, 9,748B results, ~292,961 cache_create tok (30.05×)
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
- messages: 1296
- usd: $909.6925
- input: 3,365
- cache_create_5m: 0
- cache_create_1h: 8,188,531
- cache_read: 372,671,200
- output: 1,399,724

