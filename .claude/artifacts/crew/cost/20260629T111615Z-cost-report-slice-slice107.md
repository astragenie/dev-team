---
kind: cost-report
run_title: "SLICE107"
usd: 174.1825
duration_ms: 9518478
total_tokens: 90845292
cache_hit_pct: 99.3
source_project: C--work-mega-dev-team
aggregate_all: false
source_count: 1
created_at: 2026-06-29T11:16:15.633Z
---

# Cost Report: SLICE107

- Created: 2026-06-29T11:16:15.634Z
- Run Title: SLICE107
- Window Start: 2026-06-29T08:37:37.067Z
- Window End: 2026-06-29T11:16:15.545Z
- Duration: 158.6 min (9518478 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 345
- Total Tokens: 90,845,292
- Cache Hit %: 99.3%
- Total USD: $174.1825
- Source Project: C--work-mega-dev-team
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 470
- cache_create_5m: 0
- cache_create_1h: 612,896
- cache_read: 89,953,822
- output: 278,104

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 345 msgs (100%), $174.1825 (100%)

## Conversation Shape

- user_msg_count: 9
- user_msg_avg_len: 238
- turns_before_first_tool: 2
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 6

## Tool Usage

- Bash: 93 (1 failed)
- Edit: 50 (1 failed)
- Read: 41
- Agent: 6
- Write: 4
- ToolSearch: 2
- SendMessage: 1
- TaskStop: 1

## Tool Result Sizes (bytes)

- count: 198
- sum: 185,771
- p50: 218
- p90: 2,663
- max: 14,449

## File Re-reads

- redundant_read_count: 17
- top paths:
  - 6× C:\work\mega\dev-team\scripts\crew.ts
  - 5× C:\work\mega\dev-team\evals\lib\run-eval.ts
  - 3× C:\work\mega\dev-team\scripts\lib\session-cost-scanner.ts
  - 3× C:\work\mega\dev-team\scripts\lib\preflight\checks.ts
  - 3× C:\work\mega\dev-team\scripts\render-universal-skills.ts

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 92 calls, 45,791B results, ~188,464 cache_create tok (4.12×)
- ToolSearch: 2 calls, 103B results, ~133,063 cache_create tok (1291.87×)
- Read: 41 calls, 115,125B results, ~131,447 cache_create tok (1.14×)
- Edit: 50 calls, 7,611B results, ~74,284 cache_create tok (9.76×)
- Agent: 6 calls, 10,887B results, ~57,956 cache_create tok (5.32×)
- SendMessage: 1 calls, 380B results, ~11,941 cache_create tok (31.42×)
- Write: 4 calls, 747B results, ~3,608 cache_create tok (4.83×)
- TaskStop: 1 calls, 216B results, ~1,390 cache_create tok (6.44×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 345
- usd: $174.1825
- input: 470
- cache_create_5m: 0
- cache_create_1h: 612,896
- cache_read: 89,953,822
- output: 278,104

