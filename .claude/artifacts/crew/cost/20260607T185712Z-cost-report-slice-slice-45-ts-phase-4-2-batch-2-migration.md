---
kind: cost-report
slice: SLICE-45
run_title: "SLICE-45 TS Phase 4.2 batch-2 migration"
usd: 10.9299
duration_ms: 813178
total_tokens: 20364226
cache_hit_pct: 97.5
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-07T18:57:12.958Z
---

# Cost Report: SLICE-45 TS Phase 4.2 batch-2 migration

- Created: 2026-06-07T18:57:12.958Z
- Run Title: SLICE-45 TS Phase 4.2 batch-2 migration
- Window Start: 2026-06-07T18:43:39.166Z
- Window End: 2026-06-07T18:57:12.344Z
- Duration: 13.6 min (813178 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 155
- Total Tokens: 20,364,226
- Cache Hit %: 97.5%
- Total USD: $10.9299
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Outcome Linkage

- Slice: SLICE-45
- Grade Avg: -
- Review Decision: -
- Validation Decision: -

## Tokens (totals)

- input: 161
- cache_create_5m: 0
- cache_create_1h: 496,746
- cache_read: 19,732,028
- output: 135,291

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 155 msgs (100%), $10.9299 (100%)

## Conversation Shape

- user_msg_count: 1
- user_msg_avg_len: 14989
- turns_before_first_tool: 1
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 0

## Tool Usage

- Edit: 43
- Bash: 35
- Read: 30
- Write: 1

## Tool Result Sizes (bytes)

- count: 111
- sum: 150,556
- p50: 165
- p90: 2,937
- max: 15,738

## File Re-reads

- redundant_read_count: 11
- top paths:
  - 4× C:\work\mega\hero-crew\tests\regression.test.ts
  - 3× C:\work\mega\hero-crew\tests\subagent-return.test.ts
  - 3× C:\work\mega\hero-crew\tests\ux-validation.test.ts
  - 2× C:\work\mega\hero-crew\tests\preflight-shell.test.ts
  - 2× C:\work\mega\hero-crew\tests\journey-builder.test.ts

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Read: 31 calls, 91,374B results, ~348,702 cache_create tok (3.82×)
- Edit: 43 calls, 6,765B results, ~88,661 cache_create tok (13.11×)
- Bash: 35 calls, 51,706B results, ~57,780 cache_create tok (1.12×)
- Write: 1 calls, 192B results, ~1,025 cache_create tok (5.34×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 155
- usd: $10.9299
- input: 161
- cache_create_5m: 0
- cache_create_1h: 496,746
- cache_read: 19,732,028
- output: 135,291

