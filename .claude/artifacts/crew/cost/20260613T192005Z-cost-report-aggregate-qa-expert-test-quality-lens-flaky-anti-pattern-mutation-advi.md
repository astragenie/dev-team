---
kind: cost-report
run_title: "qa-expert test-quality lens (flaky / anti-pattern / mutation advisory)"
usd: 112.8325
duration_ms: 1435575
total_tokens: 74707746
cache_hit_pct: 99.6
source_project: aggregate
aggregate_all: true
source_count: 4
created_at: 2026-06-13T19:20:05.697Z
---

# Cost Report: qa-expert test-quality lens (flaky / anti-pattern / mutation advisory)

- Created: 2026-06-13T19:20:05.697Z
- Run Title: qa-expert test-quality lens (flaky / anti-pattern / mutation advisory)
- Window Start: 2026-06-13T18:56:04.230Z
- Window End: 2026-06-13T19:19:59.805Z
- Duration: 23.9 min (1435575 ms)
- Sessions Scanned: 4
- Assistant Messages Counted: 202
- Total Tokens: 74,707,746
- Cache Hit %: 99.6%
- Total USD: $112.8325
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-hero-crew: 85 msgs, $58.2307
- C--work-mega-loopobserver: 24 msgs, $37.4954
- C--work-mega-cortex: 10 msgs, $12.5510
- C--work-mega-loop: 83 msgs, $4.5555

## Tokens (totals)

- input: 704
- cache_create_5m: 0
- cache_create_1h: 308,927
- cache_read: 74,259,625
- output: 138,490

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 119 msgs (58.91%), $108.2770 (95.96%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 83 msgs (41.09%), $4.5555 (4.04%)

## Conversation Shape

- user_msg_count: 2
- user_msg_avg_len: 109
- turns_before_first_tool: 1
- compaction_count: 1
- skill_invocations: 1
- subagent_dispatches: 6

## Tool Usage

- Bash: 68 (3 failed)
- Read: 22 (1 failed)
- Edit: 18 (1 failed)
- Agent: 6
- Write: 3
- Monitor: 1
- Skill: 1

## Tool Result Sizes (bytes)

- count: 121
- sum: 101,839
- p50: 302
- p90: 1,778
- max: 9,563

## File Re-reads

- redundant_read_count: 10
- top paths:
  - 4× C:\work\mega\loop\src\scripts\dispatch.mts
  - 3× C:\work\mega\hero-crew\tests\test-quality-integration.test.ts
  - 3× C:\work\mega\hero-crew\skills\workflow\test-quality\scripts\analyze.ts
  - 3× C:\work\mega\loop\.claude\artifacts\loop\grades\20260613T191449Z-feat094-slice133-grade.md
  - 2× C:\work\mega\hero-crew\skills\workflow\test-quality\SKILL.md

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 68 calls, 54,143B results, ~179,078 cache_create tok (3.31×)
- Read: 22 calls, 30,532B results, ~50,492 cache_create tok (1.65×)
- Agent: 5 calls, 9,223B results, ~48,393 cache_create tok (5.25×)
- Edit: 18 calls, 3,253B results, ~21,379 cache_create tok (6.57×)
- Write: 3 calls, 666B results, ~3,086 cache_create tok (4.63×)
- Monitor: 1 calls, 209B results, ~3,067 cache_create tok (14.67×)
- Skill: 1 calls, 36B results, ~3,024 cache_create tok (84×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 119
- usd: $108.2770
- input: 603
- cache_create_5m: 0
- cache_create_1h: 211,643
- cache_read: 63,077,891
- output: 97,358

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 83
- usd: $4.5555
- input: 101
- cache_create_5m: 0
- cache_create_1h: 97,284
- cache_read: 11,181,734
- output: 41,132

