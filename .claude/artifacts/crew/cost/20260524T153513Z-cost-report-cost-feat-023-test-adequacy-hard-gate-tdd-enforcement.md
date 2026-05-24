---
kind: cost-report
feature: FEAT-023
run_title: "FEAT-023 test_adequacy hard gate + TDD enforcement"
usd: 63.7901
duration_ms: 840341
total_tokens: 36806126
cache_hit_pct: 98.5
source_project: aggregate
aggregate_all: true
source_count: 5
created_at: 2026-05-24T15:35:13.439Z
---

# Cost Report: Cost — FEAT-023 test_adequacy hard gate + TDD enforcement

- Created: 2026-05-24T15:35:13.439Z
- Run Title: FEAT-023 test_adequacy hard gate + TDD enforcement
- Window Start: 2026-05-24T15:21:12.573Z
- Window End: 2026-05-24T15:35:12.914Z
- Duration: 14.0 min (840341 ms)
- Sessions Scanned: 6
- Assistant Messages Counted: 277
- Total Tokens: 36,806,126
- Cache Hit %: 98.5%
- Total USD: $63.7901
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-AstraGenie-Common: 91 msgs, $33.9932
- C--work-mega-hero-crew: 73 msgs, $24.4945
- C--work-mega-Astra-LoopObserver: 73 msgs, $2.9279
- C--work-mega-AstraGenie-MemoryService: 36 msgs, $2.1809
- C--work-mega-hero-crew-autonomous-loop: 4 msgs, $0.1937

## Tokens (totals)

- input: 501
- cache_create_5m: 0
- cache_create_1h: 533,723
- cache_read: 36,073,633
- output: 198,269

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 164 msgs (59.21%), $58.4877 (91.69%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 113 msgs (40.79%), $5.3024 (8.31%)

## Conversation Shape

- user_msg_count: 10
- user_msg_avg_len: 74
- turns_before_first_tool: 1
- compaction_count: 4
- skill_invocations: 2
- subagent_dispatches: 3

## Tool Usage

- Bash: 67
- Read: 29
- TaskUpdate: 28
- TaskCreate: 21
- Glob: 7
- ToolSearch: 6
- Write: 6 (1 failed)
- AskUserQuestion: 5 (1 failed)
- Agent: 3
- Skill: 2
- Grep: 1
- EnterPlanMode: 1
- Edit: 1

## Tool Result Sizes (bytes)

- count: 178
- sum: 234,962
- p50: 199
- p90: 4,072
- max: 30,793

## File Re-reads

- redundant_read_count: 1
- top paths:
  - 2× C:\work\mega\hero-crew\scripts\crew.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Read: 29 calls, 132,463B results, ~143,338 cache_create tok (1.08×)
- Bash: 67 calls, 49,441B results, ~124,872 cache_create tok (2.53×)
- TaskUpdate: 28 calls, 629B results, ~48,153 cache_create tok (76.55×)
- AskUserQuestion: 5 calls, 1,522B results, ~48,122 cache_create tok (31.62×)
- TaskCreate: 21 calls, 1,321B results, ~42,706 cache_create tok (32.33×)
- Glob: 7 calls, 34,652B results, ~41,018 cache_create tok (1.18×)
- Agent: 3 calls, 11,652B results, ~34,908 cache_create tok (3×)
- Write: 6 calls, 1,063B results, ~13,620 cache_create tok (12.81×)
- ToolSearch: 6 calls, 392B results, ~12,283 cache_create tok (31.33×)
- Skill: 2 calls, 70B results, ~9,252 cache_create tok (132.17×)
- Edit: 1 calls, 168B results, ~5,595 cache_create tok (33.3×)
- EnterPlanMode: 1 calls, 581B results, ~5,232 cache_create tok (9.01×)
- Grep: 1 calls, 767B results, ~3,330 cache_create tok (4.34×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 113
- usd: $5.3024
- input: 161
- cache_create_5m: 0
- cache_create_1h: 242,430
- cache_read: 10,209,037
- output: 52,310

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 164
- usd: $58.4877
- input: 340
- cache_create_5m: 0
- cache_create_1h: 291,293
- cache_read: 25,864,596
- output: 145,959

