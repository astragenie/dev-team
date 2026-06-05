---
kind: cost-report
run_title: "FEAT-038 + FEAT-039: Workflow badge awareness + tag-aware skill loading"
usd: 14.867
duration_ms: 517906
total_tokens: 15105237
cache_hit_pct: 98.5
source_project: aggregate
aggregate_all: true
source_count: 3
created_at: 2026-06-05T06:03:13.886Z
---

# Cost Report: FEAT-038 + FEAT-039: Workflow badge awareness + tag-aware skill loading

- Created: 2026-06-05T06:03:13.886Z
- Run Title: FEAT-038 + FEAT-039: Workflow badge awareness + tag-aware skill loading
- Window Start: 2026-06-05T05:54:33.764Z
- Window End: 2026-06-05T06:03:11.670Z
- Duration: 8.6 min (517906 ms)
- Sessions Scanned: 4
- Assistant Messages Counted: 120
- Total Tokens: 15,105,237
- Cache Hit %: 98.5%
- Total USD: $14.8670
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-loopobserver: 20 msgs, $10.2281
- C--work-mega-hero-crew: 78 msgs, $3.7304
- C--work-mega-loop: 22 msgs, $0.9085

## Tokens (totals)

- input: 126
- cache_create_5m: 0
- cache_create_1h: 230,699
- cache_read: 14,817,430
- output: 56,982

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 20 msgs (16.67%), $10.2281 (68.8%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 100 msgs (83.33%), $4.6389 (31.2%)

## Conversation Shape

- user_msg_count: 1
- user_msg_avg_len: 12212
- turns_before_first_tool: 1
- compaction_count: 1
- skill_invocations: 0
- subagent_dispatches: 5

## Tool Usage

- Bash: 41 (3 failed)
- Read: 9
- Edit: 6
- Agent: 5
- Grep: 2
- Write: 1
- AskUserQuestion: 1
- PowerShell: 1

## Tool Result Sizes (bytes)

- count: 68
- sum: 103,839
- p50: 402
- p90: 2,360
- max: 22,194

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 41 calls, 65,485B results, ~83,037 cache_create tok (1.27×)
- Read: 9 calls, 29,721B results, ~28,530 cache_create tok (0.96×)
- Agent: 5 calls, 5,123B results, ~27,016 cache_create tok (5.27×)
- Edit: 6 calls, 1,001B results, ~5,830 cache_create tok (5.82×)
- Write: 1 calls, 148B results, ~5,680 cache_create tok (38.38×)
- Grep: 2 calls, 368B results, ~4,465 cache_create tok (12.13×)
- AskUserQuestion: 1 calls, 158B results, ~601 cache_create tok (3.8×)
- PowerShell: 1 calls, 13B results, ~222 cache_create tok (17.08×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 100
- usd: $4.6389
- input: 106
- cache_create_5m: 0
- cache_create_1h: 193,241
- cache_read: 9,621,933
- output: 39,505

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 20
- usd: $10.2281
- input: 20
- cache_create_5m: 0
- cache_create_1h: 37,458
- cache_read: 5,195,497
- output: 17,477

