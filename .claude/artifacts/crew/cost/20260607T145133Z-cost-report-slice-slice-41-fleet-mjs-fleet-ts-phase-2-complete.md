---
kind: cost-report
slice: SLICE-41
run_title: "SLICE-41: fleet.mjs → fleet.ts (Phase 2 complete)"
usd: 0.9716
duration_ms: 712462
total_tokens: 2500987
cache_hit_pct: 99.3
review_decision: approved
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T14:51:33.087Z
---

# Cost Report: SLICE-41: fleet.mjs → fleet.ts (Phase 2 complete)

- Created: 2026-06-07T14:51:33.087Z
- Run Title: SLICE-41: fleet.mjs → fleet.ts (Phase 2 complete)
- Window Start: 2026-06-07T14:39:40.007Z
- Window End: 2026-06-07T14:51:32.469Z
- Duration: 11.9 min (712462 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 27
- Total Tokens: 2,500,987
- Cache Hit %: 99.3%
- Total USD: $0.9716
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Outcome Linkage

- Slice: SLICE-41
- Grade Avg: -
- Review Decision: approved
- Validation Decision: -

## Tokens (totals)

- input: 31
- cache_create_5m: 0
- cache_create_1h: 18,170
- cache_read: 2,474,782
- output: 8,004

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 27 msgs (100%), $0.9716 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 3

## Tool Usage

- Bash: 7
- Read: 4
- Agent: 3
- Edit: 3

## Tool Result Sizes (bytes)

- count: 18
- sum: 16,695
- p50: 996
- p90: 2,168
- max: 2,390

## File Re-reads

- redundant_read_count: 2
- top paths:
  - 3× C:\work\mega\hero-crew\scripts\lib\fleet.ts

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Agent: 3 calls, 6,624B results, ~8,802 cache_create tok (1.33×)
- Read: 4 calls, 6,199B results, ~4,462 cache_create tok (0.72×)
- Edit: 3 calls, 447B results, ~2,084 cache_create tok (4.66×)
- Bash: 7 calls, 1,319B results, ~1,975 cache_create tok (1.5×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 27
- usd: $0.9716
- input: 31
- cache_create_5m: 0
- cache_create_1h: 18,170
- cache_read: 2,474,782
- output: 8,004

