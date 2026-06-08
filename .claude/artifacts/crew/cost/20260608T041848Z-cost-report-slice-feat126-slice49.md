---
kind: cost-report
feature: FEAT-126
run_title: "FEAT126 SLICE49"
usd: 8.037
duration_ms: 721844
total_tokens: 4075422
cache_hit_pct: 99.3
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-08T04:18:48.726Z
---

# Cost Report: FEAT126 SLICE49

- Created: 2026-06-08T04:18:48.726Z
- Run Title: FEAT126 SLICE49
- Window Start: 2026-06-08T04:06:46.448Z
- Window End: 2026-06-08T04:18:48.292Z
- Duration: 12.0 min (721844 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 21
- Total Tokens: 4,075,422
- Cache Hit %: 99.3%
- Total USD: $8.0370
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 21
- cache_create_5m: 0
- cache_create_1h: 29,936
- cache_read: 4,030,902
- output: 14,563

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 21 msgs (100%), $8.0370 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 1
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 2

## Tool Usage

- TaskUpdate: 6
- Read: 3
- Write: 2 (1 failed)
- Agent: 2
- Bash: 1

## Tool Result Sizes (bytes)

- count: 14
- sum: 16,767
- p50: 96
- p90: 3,414
- max: 6,994

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Agent: 2 calls, 5,730B results, ~13,458 cache_create tok (2.35×)
- Read: 3 calls, 8,595B results, ~8,179 cache_create tok (0.95×)
- Write: 2 calls, 287B results, ~4,964 cache_create tok (17.3×)
- TaskUpdate: 6 calls, 132B results, ~1,143 cache_create tok (8.66×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 21
- usd: $8.0370
- input: 21
- cache_create_5m: 0
- cache_create_1h: 29,936
- cache_read: 4,030,902
- output: 14,563

