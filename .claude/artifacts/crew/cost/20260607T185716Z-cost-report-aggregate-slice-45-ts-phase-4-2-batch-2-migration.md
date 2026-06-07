---
kind: cost-report
slice: SLICE-45
run_title: "SLICE-45 TS Phase 4.2 batch-2 migration"
usd: 65.8045
duration_ms: 813178
total_tokens: 54306741
cache_hit_pct: 98.6
source_project: aggregate
aggregate_all: true
source_count: 3
created_at: 2026-06-07T18:57:16.002Z
---

# Cost Report: SLICE-45 TS Phase 4.2 batch-2 migration

- Created: 2026-06-07T18:57:16.002Z
- Run Title: SLICE-45 TS Phase 4.2 batch-2 migration
- Window Start: 2026-06-07T18:43:39.166Z
- Window End: 2026-06-07T18:57:12.344Z
- Duration: 13.6 min (813178 ms)
- Sessions Scanned: 3
- Assistant Messages Counted: 277
- Total Tokens: 54,306,741
- Cache Hit %: 98.6%
- Total USD: $65.8045
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-loop: 102 msgs, $52.8611
- C--work-mega-hero-crew: 155 msgs, $10.9299
- C--work-mega-loopobserver: 20 msgs, $2.0135

## Outcome Linkage

- Slice: SLICE-45
- Grade Avg: -
- Review Decision: -
- Validation Decision: -

## Tokens (totals)

- input: 349
- cache_create_5m: 0
- cache_create_1h: 773,371
- cache_read: 53,341,558
- output: 191,463

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 102 msgs (36.82%), $52.8611 (80.33%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 175 msgs (63.18%), $12.9435 (19.67%)

## Conversation Shape

- user_msg_count: 9
- user_msg_avg_len: 3317
- turns_before_first_tool: 1
- compaction_count: 5
- skill_invocations: 1
- subagent_dispatches: 3

## Tool Usage

- Bash: 64
- Edit: 48 (2 failed)
- Read: 43
- Grep: 21
- Agent: 3 (1 failed)
- Glob: 2
- Write: 1
- Skill: 1

## Tool Result Sizes (bytes)

- count: 185
- sum: 192,080
- p50: 168
- p90: 2,432
- max: 15,738

## File Re-reads

- redundant_read_count: 13
- top paths:
  - 4× C:\work\mega\hero-crew\tests\regression.test.ts
  - 3× C:\work\mega\hero-crew\tests\subagent-return.test.ts
  - 3× C:\work\mega\hero-crew\tests\ux-validation.test.ts
  - 3× C:\work\mega\loop\src\scripts\loop.mts
  - 2× C:\work\mega\hero-crew\tests\preflight-shell.test.ts

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Read: 44 calls, 111,360B results, ~369,545 cache_create tok (3.32×)
- Edit: 48 calls, 7,400B results, ~270,278 cache_create tok (36.52×)
- Bash: 64 calls, 61,586B results, ~97,390 cache_create tok (1.58×)
- Grep: 21 calls, 3,174B results, ~19,527 cache_create tok (6.15×)
- Agent: 3 calls, 7,110B results, ~12,503 cache_create tok (1.76×)
- Skill: 1 calls, 28B results, ~1,460 cache_create tok (52.14×)
- Glob: 2 calls, 711B results, ~1,065 cache_create tok (1.5×)
- Write: 1 calls, 192B results, ~1,025 cache_create tok (5.34×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 175
- usd: $12.9435
- input: 197
- cache_create_5m: 0
- cache_create_1h: 682,985
- cache_read: 22,201,336
- output: 145,638

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 102
- usd: $52.8611
- input: 152
- cache_create_5m: 0
- cache_create_1h: 90,386
- cache_read: 31,140,222
- output: 45,825

