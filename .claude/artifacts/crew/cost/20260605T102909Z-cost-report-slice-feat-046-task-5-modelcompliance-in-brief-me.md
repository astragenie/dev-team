---
kind: cost-report
run_title: "FEAT-046 Task 5 modelCompliance in brief-me"
usd: 26.4401
duration_ms: 397462
total_tokens: 20684072
cache_hit_pct: 99.3
source_project: C--work-mega-hero-crew
auto_detected: true
aggregate_all: false
source_count: 1
created_at: 2026-06-05T10:29:09.793Z
---

# Cost Report: FEAT-046 Task 5 modelCompliance in brief-me

- Created: 2026-06-05T10:29:09.793Z
- Run Title: FEAT-046 Task 5 modelCompliance in brief-me
- Window Start: 2026-06-05T10:22:30.406Z
- Window End: 2026-06-05T10:29:07.868Z
- Duration: 6.6 min (397462 ms)
- Sessions Scanned: 2
- Assistant Messages Counted: 121
- Total Tokens: 20,684,072
- Cache Hit %: 99.3%
- Total USD: $26.4401
- Source Project: C--work-mega-hero-crew
- Auto-detected: yes
- Aggregate All: no

## Tokens (totals)

- input: 127
- cache_create_5m: 0
- cache_create_1h: 134,903
- cache_read: 20,458,387
- output: 90,655

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 56 msgs (46.28%), $22.6662 (85.73%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 65 msgs (53.72%), $3.7739 (14.27%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 2

## Tool Usage

- Bash: 27
- Read: 15
- Edit: 13 (1 failed)
- TaskUpdate: 10
- Grep: 6
- Write: 5 (1 failed)
- Agent: 2

## Tool Result Sizes (bytes)

- count: 78
- sum: 44,073
- p50: 204
- p90: 1,477
- max: 5,366

## File Re-reads

- redundant_read_count: 10
- top paths:
  - 9× C:\work\mega\hero-crew\scripts\lib\workflow-state.mjs
  - 2× C:\work\mega\hero-crew\.claude\worktrees\feat-046-task-5-model-compliance\scripts\lib\briefing.mjs
  - 2× C:\work\mega\hero-crew\scripts\lib\session-cost.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 26 calls, 6,098B results, ~44,932 cache_create tok (7.37×)
- Read: 15 calls, 28,250B results, ~24,547 cache_create tok (0.87×)
- Edit: 13 calls, 2,290B results, ~19,556 cache_create tok (8.54×)
- TaskUpdate: 10 calls, 229B results, ~15,194 cache_create tok (66.35×)
- Write: 5 calls, 963B results, ~14,062 cache_create tok (14.6×)
- Agent: 2 calls, 3,030B results, ~8,531 cache_create tok (2.82×)
- Grep: 6 calls, 2,930B results, ~6,054 cache_create tok (2.07×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 56
- usd: $22.6662
- input: 56
- cache_create_5m: 0
- cache_create_1h: 77,956
- cache_read: 10,993,515
- output: 51,152

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 65
- usd: $3.7739
- input: 71
- cache_create_5m: 0
- cache_create_1h: 56,947
- cache_read: 9,464,872
- output: 39,503

