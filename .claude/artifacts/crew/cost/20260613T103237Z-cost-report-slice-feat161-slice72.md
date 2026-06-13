---
kind: cost-report
feature: FEAT-161
run_title: "FEAT161 SLICE72"
usd: 38.6183
duration_ms: 4334451
total_tokens: 18728407
cache_hit_pct: 99.2
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-13T10:32:37.508Z
---

# Cost Report: FEAT161 SLICE72

- Created: 2026-06-13T10:32:37.508Z
- Run Title: FEAT161 SLICE72
- Window Start: 2026-06-13T09:20:22.456Z
- Window End: 2026-06-13T10:32:36.907Z
- Duration: 72.2 min (4334451 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 67
- Total Tokens: 18,728,407
- Cache Hit %: 99.2%
- Total USD: $38.6183
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 117
- cache_create_5m: 0
- cache_create_1h: 156,930
- cache_read: 18,489,025
- output: 82,335

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 67 msgs (100%), $38.6183 (100%)

## Conversation Shape

- user_msg_count: 3
- user_msg_avg_len: 4
- turns_before_first_tool: 1
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 6

## Tool Usage

- Bash: 21
- Agent: 6
- Read: 4
- Edit: 3 (1 failed)
- Write: 2 (1 failed)
- Grep: 1

## Tool Result Sizes (bytes)

- count: 37
- sum: 36,785
- p50: 344
- p90: 2,757
- max: 8,654

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Agent: 6 calls, 11,942B results, ~92,938 cache_create tok (7.78×)
- Bash: 20 calls, 10,997B results, ~34,988 cache_create tok (3.18×)
- Edit: 3 calls, 590B results, ~10,361 cache_create tok (17.56×)
- Write: 2 calls, 296B results, ~5,616 cache_create tok (18.97×)
- Read: 4 calls, 4,209B results, ~4,293 cache_create tok (1.02×)
- Grep: 1 calls, 97B results, ~618 cache_create tok (6.37×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 67
- usd: $38.6183
- input: 117
- cache_create_5m: 0
- cache_create_1h: 156,930
- cache_read: 18,489,025
- output: 82,335

