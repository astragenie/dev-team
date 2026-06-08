---
kind: cost-report
feature: FEAT-134
run_title: "FEAT134 SLICE61"
usd: 6.6493
duration_ms: 689241
total_tokens: 4797042
cache_hit_pct: 99.2
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-08T22:42:23.517Z
---

# Cost Report: FEAT134 SLICE61

- Created: 2026-06-08T22:42:23.517Z
- Run Title: FEAT134 SLICE61
- Window Start: 2026-06-08T22:30:53.871Z
- Window End: 2026-06-08T22:42:23.112Z
- Duration: 11.5 min (689241 ms)
- Sessions Scanned: 2
- Assistant Messages Counted: 39
- Total Tokens: 4,797,042
- Cache Hit %: 99.2%
- Total USD: $6.6493
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 89
- cache_create_5m: 0
- cache_create_1h: 36,224
- cache_read: 4,734,266
- output: 26,463

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 22 msgs (56.41%), $5.7680 (86.75%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 17 msgs (43.59%), $0.8812 (13.25%)

## Conversation Shape

- user_msg_count: 5
- user_msg_avg_len: 5
- turns_before_first_tool: 2
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 2

## Tool Usage

- TaskUpdate: 6
- Bash: 6
- AskUserQuestion: 2
- Agent: 2
- Read: 1
- Edit: 1

## Tool Result Sizes (bytes)

- count: 20
- sum: 10,883
- p50: 163
- p90: 1,717
- max: 4,281

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- TaskUpdate: 6 calls, 132B results, ~11,822 cache_create tok (89.56×)
- Agent: 2 calls, 5,998B results, ~10,591 cache_create tok (1.77×)
- AskUserQuestion: 2 calls, 307B results, ~6,022 cache_create tok (19.62×)
- Bash: 6 calls, 2,763B results, ~3,273 cache_create tok (1.18×)
- Read: 1 calls, 1,201B results, ~1,198 cache_create tok (1×)
- Edit: 1 calls, 187B results, ~0 cache_create tok (0×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 22
- usd: $5.7680
- input: 62
- cache_create_5m: 0
- cache_create_1h: 21,162
- cache_read: 2,450,495
- output: 19,420

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 17
- usd: $0.8812
- input: 27
- cache_create_5m: 0
- cache_create_1h: 15,062
- cache_read: 2,283,771
- output: 7,043

