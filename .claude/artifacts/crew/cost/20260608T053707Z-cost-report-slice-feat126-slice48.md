---
kind: cost-report
feature: FEAT-126
run_title: "FEAT126 SLICE48"
usd: 55.2276
duration_ms: 3878571
total_tokens: 35623737
cache_hit_pct: 98.4
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-08T05:37:07.951Z
---

# Cost Report: FEAT126 SLICE48

- Created: 2026-06-08T05:37:07.951Z
- Run Title: FEAT126 SLICE48
- Window Start: 2026-06-08T04:32:28.948Z
- Window End: 2026-06-08T05:37:07.519Z
- Duration: 64.6 min (3878571 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 191
- Total Tokens: 35,623,737
- Cache Hit %: 98.4%
- Total USD: $55.2276
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 263
- cache_create_5m: 0
- cache_create_1h: 579,831
- cache_read: 34,964,836
- output: 78,807

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 119 msgs (62.3%), $50.0954 (90.71%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 72 msgs (37.7%), $5.1323 (9.29%)

## Conversation Shape

- user_msg_count: 12
- user_msg_avg_len: 910
- turns_before_first_tool: 0
- compaction_count: 5
- skill_invocations: 0
- subagent_dispatches: 2

## Tool Usage

- Bash: 52 (1 failed)
- Edit: 25 (3 failed)
- Read: 22
- Grep: 22
- TaskUpdate: 5
- Glob: 3
- Write: 2
- Agent: 2

## Tool Result Sizes (bytes)

- count: 134
- sum: 129,572
- p50: 260
- p90: 2,273
- max: 21,027

## File Re-reads

- redundant_read_count: 4
- top paths:
  - 4× C:\work\mega\hero-crew\agents\builder-be.md
  - 2× C:\work\mega\hero-crew\docs\routing-table.md

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 52 calls, 41,959B results, ~322,586 cache_create tok (7.69×)
- Grep: 22 calls, 14,440B results, ~181,428 cache_create tok (12.56×)
- Read: 22 calls, 58,138B results, ~45,517 cache_create tok (0.78×)
- Edit: 25 calls, 3,671B results, ~14,152 cache_create tok (3.86×)
- Agent: 2 calls, 6,714B results, ~9,184 cache_create tok (1.37×)
- Glob: 3 calls, 3,023B results, ~2,845 cache_create tok (0.94×)
- Write: 2 calls, 396B results, ~2,821 cache_create tok (7.12×)
- TaskUpdate: 5 calls, 110B results, ~559 cache_create tok (5.08×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 119
- usd: $50.0954
- input: 159
- cache_create_5m: 0
- cache_create_1h: 96,314
- cache_read: 29,191,934
- output: 45,542

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 72
- usd: $5.1323
- input: 104
- cache_create_5m: 0
- cache_create_1h: 483,517
- cache_read: 5,772,902
- output: 33,265

