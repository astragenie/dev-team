---
kind: cost-report
run_title: "FEAT-045 observability hook health + synthesis fixes"
usd: 39.044
duration_ms: 734278
total_tokens: 24974298
cache_hit_pct: 97.8
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-05T10:50:41.514Z
---

# Cost Report: FEAT-045 observability hook health + synthesis fixes

- Created: 2026-06-05T10:50:41.515Z
- Run Title: FEAT-045 observability hook health + synthesis fixes
- Window Start: 2026-06-05T10:38:26.973Z
- Window End: 2026-06-05T10:50:41.251Z
- Duration: 12.2 min (734278 ms)
- Sessions Scanned: 2
- Assistant Messages Counted: 169
- Total Tokens: 24,974,298
- Cache Hit %: 97.8%
- Total USD: $39.0440
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 362
- cache_create_5m: 0
- cache_create_1h: 550,967
- cache_read: 24,358,440
- output: 64,529

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 57 msgs (33.73%), $34.3271 (87.92%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 112 msgs (66.27%), $4.7169 (12.08%)

## Conversation Shape

- user_msg_count: 5
- user_msg_avg_len: 9
- turns_before_first_tool: 0
- compaction_count: 42
- skill_invocations: 0
- subagent_dispatches: 1

## Tool Usage

- Bash: 39
- Edit: 18
- Read: 15
- Write: 6
- ExitWorktree: 1
- Agent: 1

## Tool Result Sizes (bytes)

- count: 81
- sum: 47,311
- p50: 245
- p90: 1,396
- max: 4,048

## File Re-reads

- redundant_read_count: 7
- top paths:
  - 4× C:/work/mega/hero-crew/scripts/lib/wakeup.mjs
  - 3× C:/work/mega/hero-crew/scripts/lib/briefing/collect.mjs
  - 3× C:/work/mega/hero-crew/scripts/lib/briefing.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 39 calls, 24,030B results, ~512,280 cache_create tok (21.32×)
- Edit: 18 calls, 2,792B results, ~14,643 cache_create tok (5.24×)
- Read: 15 calls, 15,125B results, ~9,995 cache_create tok (0.66×)
- Agent: 1 calls, 4,048B results, ~6,540 cache_create tok (1.62×)
- Write: 6 calls, 898B results, ~6,509 cache_create tok (7.25×)
- ExitWorktree: 1 calls, 173B results, ~560 cache_create tok (3.24×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 57
- usd: $34.3271
- input: 244
- cache_create_5m: 0
- cache_create_1h: 455,562
- cache_read: 13,354,714
- output: 8,327

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 112
- usd: $4.7169
- input: 118
- cache_create_5m: 0
- cache_create_1h: 95,405
- cache_read: 11,003,726
- output: 56,202

