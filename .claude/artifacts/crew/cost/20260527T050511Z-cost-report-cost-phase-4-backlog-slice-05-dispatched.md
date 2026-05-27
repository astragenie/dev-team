---
kind: cost-report
slice: SLICE-05
run_title: "Phase 4 backlog + SLICE-05 dispatched"
usd: 11.6294
duration_ms: 99290
total_tokens: 6739476
cache_hit_pct: 99.5
source_project: aggregate
aggregate_all: true
source_count: 2
created_at: 2026-05-27T05:05:11.562Z
---

# Cost Report: Cost — Phase 4 backlog + SLICE-05 dispatched

- Created: 2026-05-27T05:05:11.562Z
- Run Title: Phase 4 backlog + SLICE-05 dispatched
- Window Start: 2026-05-27T05:03:31.412Z
- Window End: 2026-05-27T05:05:10.702Z
- Duration: 1.7 min (99290 ms)
- Sessions Scanned: 2
- Assistant Messages Counted: 28
- Total Tokens: 6,739,476
- Cache Hit %: 99.5%
- Total USD: $11.6294
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-hero-crew-autonomous-loop: 19 msgs, $7.6371
- C--work-mega-hero-crew: 9 msgs, $3.9922

## Outcome Linkage

- Slice: SLICE-05
- Grade Avg: -
- Review Decision: -
- Validation Decision: -

## Tokens (totals)

- input: 40
- cache_create_5m: 0
- cache_create_1h: 36,121
- cache_read: 6,696,646
- output: 6,669

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 28 msgs (100%), $11.6294 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 1
- compaction_count: 2
- skill_invocations: 0
- subagent_dispatches: 1

## Tool Usage

- Bash: 8
- Read: 5
- Grep: 3
- Agent: 1

## Tool Result Sizes (bytes)

- count: 18
- sum: 12,225
- p50: 389
- p90: 1,693
- max: 2,453

## File Re-reads

- redundant_read_count: 2
- top paths:
  - 3× C:\work\mega\hero-crew-autonomous-loop\scripts\lib\backlog-writer.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 8 calls, 3,390B results, ~26,990 cache_create tok (7.96×)
- Read: 5 calls, 6,074B results, ~4,003 cache_create tok (0.66×)
- Agent: 1 calls, 879B results, ~2,241 cache_create tok (2.55×)
- Grep: 3 calls, 395B results, ~1,611 cache_create tok (4.08×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 28
- usd: $11.6294
- input: 40
- cache_create_5m: 0
- cache_create_1h: 36,121
- cache_read: 6,696,646
- output: 6,669

