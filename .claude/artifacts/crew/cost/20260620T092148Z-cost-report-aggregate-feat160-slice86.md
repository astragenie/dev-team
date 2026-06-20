---
kind: cost-report
feature: FEAT-160
run_title: "FEAT160 SLICE86"
usd: 20.876
duration_ms: 39605
total_tokens: 12732364
cache_hit_pct: 99.9
source_project: aggregate
aggregate_all: true
source_count: 5
created_at: 2026-06-20T09:21:48.477Z
---

# Cost Report: FEAT160 SLICE86

- Created: 2026-06-20T09:21:48.477Z
- Run Title: FEAT160 SLICE86
- Window Start: 2026-06-20T09:21:02.803Z
- Window End: 2026-06-20T09:21:42.408Z
- Duration: 0.7 min (39605 ms)
- Sessions Scanned: 5
- Assistant Messages Counted: 26
- Total Tokens: 12,732,364
- Cache Hit %: 99.9%
- Total USD: $20.8760
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-devops: 9 msgs, $10.8675
- C--work-mega-hero-crew: 6 msgs, $3.8322
- C--work-mega: 4 msgs, $2.9010
- C--work-mega-loop: 2 msgs, $2.3766
- C--work-mega-memory: 5 msgs, $0.8987

## Tokens (totals)

- input: 26
- cache_create_5m: 0
- cache_create_1h: 15,494
- cache_read: 12,698,674
- output: 18,170

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 26 msgs (100%), $20.8760 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 0

## Tool Usage

- Bash: 10 (1 failed)
- Read: 3
- Edit: 2
- PowerShell: 1

## Tool Result Sizes (bytes)

- count: 18
- sum: 21,775
- p50: 425
- p90: 2,376
- max: 10,772

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 8 calls, 5,605B results, ~12,583 cache_create tok (2.24×)
- Read: 3 calls, 11,591B results, ~1,260 cache_create tok (0.11×)
- Edit: 2 calls, 398B results, ~774 cache_create tok (1.94×)
- PowerShell: 1 calls, 2,358B results, ~537 cache_create tok (0.23×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 26
- usd: $20.8760
- input: 26
- cache_create_5m: 0
- cache_create_1h: 15,494
- cache_read: 12,698,674
- output: 18,170

