---
kind: cost-report
feature: FEAT-002
run_title: "FEAT002 SLICE06"
usd: 4.9903
duration_ms: 65630
total_tokens: 2829037
cache_hit_pct: 99.5
source_project: aggregate
aggregate_all: true
source_count: 2
created_at: 2026-05-27T05:18:12.474Z
---

# Cost Report: FEAT002 SLICE06

- Created: 2026-05-27T05:18:12.474Z
- Run Title: FEAT002 SLICE06
- Window Start: 2026-05-27T05:11:57.945Z
- Window End: 2026-05-27T05:13:03.575Z
- Duration: 1.1 min (65630 ms)
- Sessions Scanned: 2
- Assistant Messages Counted: 19
- Total Tokens: 2,829,037
- Cache Hit %: 99.5%
- Total USD: $4.9903
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-hero-crew: 6 msgs, $2.7807
- C--work-mega-AstraGenie-MemoryService: 13 msgs, $2.2096

## Tokens (totals)

- input: 23
- cache_create_5m: 0
- cache_create_1h: 13,356
- cache_read: 2,810,681
- output: 4,977

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 19 msgs (100%), $4.9903 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 0
- compaction_count: 2
- skill_invocations: 1
- subagent_dispatches: 1

## Tool Usage

- Bash: 11
- Skill: 1
- Agent: 1

## Tool Result Sizes (bytes)

- count: 12
- sum: 11,842
- p50: 623
- p90: 2,492
- max: 4,710

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 10 calls, 9,479B results, ~10,278 cache_create tok (1.08×)
- Agent: 1 calls, 879B results, ~1,746 cache_create tok (1.99×)
- Skill: 0 calls, 0B results, ~637 cache_create tok (—)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 19
- usd: $4.9903
- input: 23
- cache_create_5m: 0
- cache_create_1h: 13,356
- cache_read: 2,810,681
- output: 4,977

