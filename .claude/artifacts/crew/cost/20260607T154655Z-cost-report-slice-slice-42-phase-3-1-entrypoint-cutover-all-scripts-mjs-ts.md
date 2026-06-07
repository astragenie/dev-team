---
kind: cost-report
slice: SLICE-42
run_title: "SLICE-42: Phase 3.1 entrypoint cutover — all scripts .mjs → .ts"
usd: 8.6284
duration_ms: 2966032
total_tokens: 15996983
cache_hit_pct: 97.5
review_decision: approved
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T15:46:55.094Z
---

# Cost Report: SLICE-42: Phase 3.1 entrypoint cutover — all scripts .mjs → .ts

- Created: 2026-06-07T15:46:55.094Z
- Run Title: SLICE-42: Phase 3.1 entrypoint cutover — all scripts .mjs → .ts
- Window Start: 2026-06-07T14:57:28.413Z
- Window End: 2026-06-07T15:46:54.445Z
- Duration: 49.4 min (2966032 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 139
- Total Tokens: 15,996,983
- Cache Hit %: 97.5%
- Total USD: $8.6284
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Outcome Linkage

- Slice: SLICE-42
- Grade Avg: -
- Review Decision: approved
- Validation Decision: -

## Tokens (totals)

- input: 173
- cache_create_5m: 0
- cache_create_1h: 401,607
- cache_read: 15,490,465
- output: 104,738

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 139 msgs (100%), $8.6284 (100%)

## Conversation Shape

- user_msg_count: 1
- user_msg_avg_len: 13656
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 4

## Tool Usage

- Read: 46
- Bash: 34 (3 failed)
- Agent: 4
- ToolSearch: 1
- Glob: 1

## Tool Result Sizes (bytes)

- count: 87
- sum: 163,820
- p50: 929
- p90: 4,287
- max: 12,220

## File Re-reads

- redundant_read_count: 38
- top paths:
  - 35× C:\work\mega\hero-crew\scripts\crew.ts
  - 3× C:\work\mega\hero-crew\scripts\lib\artifacts\types.ts
  - 2× C:\work\mega\hero-crew\scripts\lib\claims.ts
  - 2× C:\work\mega\hero-crew\scripts\lib\workflow-state.ts

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Read: 46 calls, 99,228B results, ~293,126 cache_create tok (2.95×)
- Bash: 34 calls, 58,575B results, ~74,875 cache_create tok (1.28×)
- Agent: 4 calls, 4,264B results, ~26,974 cache_create tok (6.33×)
- ToolSearch: 1 calls, 103B results, ~5,817 cache_create tok (56.48×)
- Glob: 1 calls, 1,504B results, ~602 cache_create tok (0.4×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 139
- usd: $8.6284
- input: 173
- cache_create_5m: 0
- cache_create_1h: 401,607
- cache_read: 15,490,465
- output: 104,738

