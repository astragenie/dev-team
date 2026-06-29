---
kind: cost-report
run_title: "SLICE108"
usd: 388.7431
duration_ms: 3557619
total_tokens: 229044182
cache_hit_pct: 99.8
source_project: aggregate
aggregate_all: true
source_count: 5
created_at: 2026-06-29T12:23:11.502Z
---

# Cost Report: SLICE108

- Created: 2026-06-29T12:23:11.502Z
- Run Title: SLICE108
- Window Start: 2026-06-29T11:23:46.873Z
- Window End: 2026-06-29T12:23:04.492Z
- Duration: 59.3 min (3557619 ms)
- Sessions Scanned: 5
- Assistant Messages Counted: 413
- Total Tokens: 229,044,182
- Cache Hit %: 99.8%
- Total USD: $388.7431
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-sales: 83 msgs, $127.8581
- C--work-mega-runner: 62 msgs, $83.7467
- C--work-mega-dev-team: 85 msgs, $68.1956
- C--work-mega-common: 71 msgs, $54.6848
- C--work-mega-dating: 112 msgs, $54.2579

## Tokens (totals)

- input: 1,038
- cache_create_5m: 0
- cache_create_1h: 556,290
- cache_read: 228,088,098
- output: 398,756

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 413 msgs (100%), $388.7431 (100%)

## Conversation Shape

- user_msg_count: 50
- user_msg_avg_len: 756
- turns_before_first_tool: 2
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 10

## Tool Usage

- Bash: 115 (11 failed)
- Edit: 22 (1 failed)
- Read: 13 (1 failed)
- Agent: 10
- Write: 6
- Monitor: 5
- TaskUpdate: 4
- SendMessage: 3
- AskUserQuestion: 3
- TaskCreate: 3
- TaskStop: 1

## Tool Result Sizes (bytes)

- count: 185
- sum: 112,678
- p50: 276
- p90: 1,288
- max: 15,600

## File Re-reads

- redundant_read_count: 1
- top paths:
  - 2× C:\work\mega\sales\tests\Sales.Api.Tests\Controllers\DiscoveryConfigControllerTests.cs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 114 calls, 61,283B results, ~262,175 cache_create tok (4.28×)
- Agent: 10 calls, 9,845B results, ~96,485 cache_create tok (9.8×)
- AskUserQuestion: 3 calls, 797B results, ~37,261 cache_create tok (46.75×)
- SendMessage: 3 calls, 1,138B results, ~27,500 cache_create tok (24.17×)
- Write: 6 calls, 1,059B results, ~24,979 cache_create tok (23.59×)
- Edit: 22 calls, 3,649B results, ~24,011 cache_create tok (6.58×)
- Read: 13 calls, 16,504B results, ~21,504 cache_create tok (1.3×)
- TaskUpdate: 4 calls, 95B results, ~19,207 cache_create tok (202.18×)
- TaskCreate: 3 calls, 239B results, ~15,828 cache_create tok (66.23×)
- Monitor: 5 calls, 1,040B results, ~11,884 cache_create tok (11.43×)
- TaskStop: 1 calls, 1,429B results, ~2,256 cache_create tok (1.58×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 413
- usd: $388.7431
- input: 1,038
- cache_create_5m: 0
- cache_create_1h: 556,290
- cache_read: 228,088,098
- output: 398,756

