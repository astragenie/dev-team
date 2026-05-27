---
kind: cost-report
feature: FEAT-001
run_title: "FEAT001 SLICE05"
usd: 15.135
duration_ms: 99290
total_tokens: 7167956
cache_hit_pct: 98.1
source_project: aggregate
aggregate_all: true
source_count: 3
created_at: 2026-05-27T05:11:33.675Z
---

# Cost Report: FEAT001 SLICE05

- Created: 2026-05-27T05:11:33.675Z
- Run Title: FEAT001 SLICE05
- Window Start: 2026-05-27T05:03:31.412Z
- Window End: 2026-05-27T05:05:10.702Z
- Duration: 1.7 min (99290 ms)
- Sessions Scanned: 3
- Assistant Messages Counted: 33
- Total Tokens: 7,167,956
- Cache Hit %: 98.1%
- Total USD: $15.1350
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-hero-crew-autonomous-loop: 19 msgs, $7.6371
- C--work-mega-hero-crew: 10 msgs, $4.4428
- C--work-mega-AstraGenie-MemoryService: 4 msgs, $3.0551

## Tokens (totals)

- input: 51
- cache_create_5m: 0
- cache_create_1h: 132,972
- cache_read: 7,026,869
- output: 8,064

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 33 msgs (100%), $15.1350 (100%)

## Conversation Shape

- user_msg_count: 1
- user_msg_avg_len: 92
- turns_before_first_tool: 1
- compaction_count: 3
- skill_invocations: 0
- subagent_dispatches: 1

## Tool Usage

- Bash: 12
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

- Bash: 8 calls, 3,390B results, ~76,973 cache_create tok (22.71×)
- Read: 5 calls, 6,074B results, ~4,003 cache_create tok (0.66×)
- Agent: 1 calls, 879B results, ~2,241 cache_create tok (2.55×)
- Grep: 3 calls, 395B results, ~1,611 cache_create tok (4.08×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 33
- usd: $15.1350
- input: 51
- cache_create_5m: 0
- cache_create_1h: 132,972
- cache_read: 7,026,869
- output: 8,064

