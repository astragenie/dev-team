---
kind: cost-report
feature: LoopObserver-plan-tasks-1-2
run_title: "LoopObserver plan tasks 1+2 — write-handoff --repo-context + reviewer D2/D3"
usd: 33.0103
duration_ms: 482975
total_tokens: 28013020
cache_hit_pct: 98.4
source_project: aggregate
aggregate_all: true
source_count: 5
created_at: 2026-05-24T16:15:14.604Z
---

# Cost Report: Cost — LoopObserver plan tasks 1+2 — write-handoff --repo-context + reviewer D2/D3

- Created: 2026-05-24T16:15:14.604Z
- Run Title: LoopObserver plan tasks 1+2 — write-handoff --repo-context + reviewer D2/D3
- Window Start: 2026-05-24T16:07:11.072Z
- Window End: 2026-05-24T16:15:14.047Z
- Duration: 8.0 min (482975 ms)
- Sessions Scanned: 5
- Assistant Messages Counted: 199
- Total Tokens: 28,013,020
- Cache Hit %: 98.4%
- Total USD: $33.0103
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-hero-crew: 28 msgs, $12.9656
- C--work-mega-AstraGenie-Common: 23 msgs, $12.6573
- C--work-mega-hero-crew-autonomous-loop: 68 msgs, $3.6524
- C--work-mega-AstraGenie-MemoryService: 49 msgs, $2.5367
- C--work-mega-Astra-LoopObserver: 31 msgs, $1.1983

## Tokens (totals)

- input: 273
- cache_create_5m: 0
- cache_create_1h: 444,531
- cache_read: 27,461,177
- output: 107,039

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 51 msgs (25.63%), $25.6229 (77.62%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 148 msgs (74.37%), $7.3874 (22.38%)

## Conversation Shape

- user_msg_count: 8
- user_msg_avg_len: 1624
- turns_before_first_tool: 1
- compaction_count: 3
- skill_invocations: 1
- subagent_dispatches: 2

## Tool Usage

- Bash: 50 (4 failed)
- Read: 23
- Edit: 9
- TaskUpdate: 8
- TaskCreate: 7
- Grep: 4
- Glob: 3
- Write: 3
- PowerShell: 2
- Agent: 2
- Skill: 1
- ToolSearch: 1

## Tool Result Sizes (bytes)

- count: 113
- sum: 167,321
- p50: 278
- p90: 3,138
- max: 19,942

## File Re-reads

- redundant_read_count: 5
- top paths:
  - 3× C:\work\mega\hero-crew-autonomous-loop\scripts\lib\stop-conditions.mjs
  - 3× C:\work\mega\hero-crew-autonomous-loop\scripts\lib\slice-linker.mjs
  - 2× C:\work\mega\AstraGenie.MemoryService\.claude\crew\deployment.md

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Read: 23 calls, 72,384B results, ~191,935 cache_create tok (2.65×)
- Bash: 49 calls, 82,067B results, ~122,592 cache_create tok (1.49×)
- Glob: 3 calls, 1,053B results, ~47,546 cache_create tok (45.15×)
- Edit: 9 calls, 1,572B results, ~19,195 cache_create tok (12.21×)
- Agent: 2 calls, 4,188B results, ~18,564 cache_create tok (4.43×)
- TaskCreate: 7 calls, 474B results, ~12,712 cache_create tok (26.82×)
- Write: 3 calls, 496B results, ~12,080 cache_create tok (24.35×)
- TaskUpdate: 8 calls, 183B results, ~9,938 cache_create tok (54.31×)
- Grep: 4 calls, 4,284B results, ~2,488 cache_create tok (0.58×)
- PowerShell: 2 calls, 254B results, ~1,955 cache_create tok (7.7×)
- Skill: 1 calls, 36B results, ~1,446 cache_create tok (40.17×)
- ToolSearch: 1 calls, 52B results, ~880 cache_create tok (16.92×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 148
- usd: $7.3874
- input: 192
- cache_create_5m: 0
- cache_create_1h: 367,497
- cache_read: 14,056,975
- output: 64,314

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 51
- usd: $25.6229
- input: 81
- cache_create_5m: 0
- cache_create_1h: 77,034
- cache_read: 13,404,202
- output: 42,725

