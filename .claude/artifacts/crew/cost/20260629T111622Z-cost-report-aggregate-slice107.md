---
kind: cost-report
run_title: "SLICE107"
usd: 1248.4692
duration_ms: 9518583
total_tokens: 705774603
cache_hit_pct: 99.5
source_project: aggregate
aggregate_all: true
source_count: 9
created_at: 2026-06-29T11:16:22.104Z
---

# Cost Report: SLICE107

- Created: 2026-06-29T11:16:22.104Z
- Run Title: SLICE107
- Window Start: 2026-06-29T08:37:37.067Z
- Window End: 2026-06-29T11:16:15.650Z
- Duration: 158.6 min (9518583 ms)
- Sessions Scanned: 10
- Assistant Messages Counted: 1458
- Total Tokens: 705,774,603
- Cache Hit %: 99.5%
- Total USD: $1248.4692
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-sales: 404 msgs, $539.1424
- C--work-mega-common: 373 msgs, $254.7767
- C--work-mega-runner: 198 msgs, $230.1517
- C--work-mega-dev-team: 345 msgs, $174.1825
- C--work-mega-dating: 122 msgs, $48.0652
- C--Users-serge-AppData-Local-Temp-crew-eval-judge-UOFIzZ: 6 msgs, $0.6611
- C--Users-serge-AppData-Local-Temp-crew-eval-judge-HRS633: 6 msgs, $0.6297
- C--Users-serge-AppData-Local-Temp-crew-eval-judge-198mMu: 2 msgs, $0.5219
- C--Users-serge-AppData-Local-Temp-crew-eval-judge-Eadd3l: 2 msgs, $0.3381

## Tokens (totals)

- input: 4,122
- cache_create_5m: 0
- cache_create_1h: 3,502,418
- cache_read: 700,927,441
- output: 1,340,622

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 1442 msgs (98.9%), $1246.3184 (99.83%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 16 msgs (1.1%), $2.1508 (0.17%)

## Conversation Shape

- user_msg_count: 84
- user_msg_avg_len: 546
- turns_before_first_tool: 6
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 24

## Tool Usage

- Bash: 439 (8 failed)
- Edit: 122 (12 failed)
- Read: 119 (1 failed)
- PowerShell: 25 (5 failed)
- Agent: 24
- TaskUpdate: 19
- Write: 18
- Monitor: 13
- SendMessage: 8
- TaskCreate: 8
- Grep: 6
- ToolSearch: 4
- TaskStop: 4
- Glob: 3
- AskUserQuestion: 1

## Tool Result Sizes (bytes)

- count: 812
- sum: 753,584
- p50: 319
- p90: 2,341
- max: 16,387

## File Re-reads

- redundant_read_count: 33
- top paths:
  - 6× C:\work\mega\dev-team\scripts\crew.ts
  - 5× C:\work\mega\dev-team\evals\lib\run-eval.ts
  - 5× C:\work\mega\sales\src\Sales.Infrastructure\Discovery\BigQuery\BigQueryDiscoverySource.cs
  - 3× C:\work\mega\dev-team\scripts\lib\session-cost-scanner.ts
  - 3× C:\work\mega\dev-team\scripts\lib\preflight\checks.ts

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 437 calls, 348,754B results, ~1,044,960 cache_create tok (3×)
- Agent: 24 calls, 28,124B results, ~1,002,412 cache_create tok (35.64×)
- Read: 119 calls, 290,691B results, ~381,857 cache_create tok (1.31×)
- PowerShell: 25 calls, 30,848B results, ~222,231 cache_create tok (7.2×)
- Edit: 122 calls, 20,164B results, ~207,789 cache_create tok (10.3×)
- ToolSearch: 4 calls, 251B results, ~143,115 cache_create tok (570.18×)
- Write: 18 calls, 3,069B results, ~80,668 cache_create tok (26.28×)
- TaskUpdate: 19 calls, 448B results, ~65,233 cache_create tok (145.61×)
- Grep: 6 calls, 15,092B results, ~35,587 cache_create tok (2.36×)
- SendMessage: 8 calls, 2,774B results, ~34,311 cache_create tok (12.37×)
- Monitor: 13 calls, 2,710B results, ~28,829 cache_create tok (10.64×)
- TaskStop: 4 calls, 4,673B results, ~19,138 cache_create tok (4.1×)
- TaskCreate: 8 calls, 673B results, ~16,901 cache_create tok (25.11×)
- Glob: 3 calls, 186B results, ~4,190 cache_create tok (22.53×)
- AskUserQuestion: 1 calls, 216B results, ~3,540 cache_create tok (16.39×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 16
- usd: $2.1508
- input: 36
- cache_create_5m: 0
- cache_create_1h: 294,443
- cache_read: 375,816
- output: 18,083

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 1442
- usd: $1246.3184
- input: 4,086
- cache_create_5m: 0
- cache_create_1h: 3,207,975
- cache_read: 700,551,625
- output: 1,322,539

