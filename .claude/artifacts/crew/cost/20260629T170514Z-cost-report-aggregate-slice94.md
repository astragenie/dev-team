---
kind: cost-report
run_title: "SLICE94"
usd: 1223.0804
duration_ms: 20481113
total_tokens: 543814675
cache_hit_pct: 97.8
source_project: aggregate
aggregate_all: true
source_count: 17
created_at: 2026-06-29T17:05:14.837Z
---

# Cost Report: SLICE94

- Created: 2026-06-29T17:05:14.837Z
- Run Title: SLICE94
- Window Start: 2026-06-29T11:23:46.873Z
- Window End: 2026-06-29T17:05:07.986Z
- Duration: 341.4 min (20481113 ms)
- Sessions Scanned: 17
- Assistant Messages Counted: 1121
- Total Tokens: 543,814,675
- Cache Hit %: 97.8%
- Total USD: $1223.0804
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-runner: 165 msgs, $311.9770
- C--work-mega-dating: 268 msgs, $249.6258
- C--work-mega-common: 211 msgs, $236.6508
- C--work-mega-dev-team: 221 msgs, $219.9554
- C--work-mega-sales: 97 msgs, $149.3538
- C--work-mega-devops: 107 msgs, $49.6860
- C--Users-serge-AppData-Local-Temp-crew-eval-judge-zGZh7e: 6 msgs, $0.8085
- C--Users-serge-AppData-Local-Temp-crew-eval-judge-AnnJz8: 5 msgs, $0.8004
- C--Users-serge-AppData-Local-Temp-crew-eval-judge-yPA2gE: 9 msgs, $0.6167
- C--Users-serge-AppData-Local-Temp-crew-eval-judge-kSN5ee: 5 msgs, $0.5588
- C--Users-serge-AppData-Local-Temp-crew-eval-judge-0ap6HD: 5 msgs, $0.5445
- C--Users-serge-AppData-Local-Temp-crew-eval-judge-Zar02Z: 5 msgs, $0.5350
- C--Users-serge-AppData-Local-Temp-crew-eval-judge-5QKASk: 5 msgs, $0.5235
- C--Users-serge-AppData-Local-Temp-crew-eval-judge-PaVu1m: 2 msgs, $0.3712
- C--Users-serge-AppData-Local-Temp-crew-eval-judge-KqS50L: 2 msgs, $0.3679
- C--Users-serge-AppData-Local-Temp-crew-eval-judge-0Kpwlc: 4 msgs, $0.3528
- C--Users-serge-AppData-Local-Temp-crew-eval-judge-3jdBY0: 4 msgs, $0.3522

## Tokens (totals)

- input: 3,949
- cache_create_5m: 0
- cache_create_1h: 12,150,723
- cache_read: 530,512,576
- output: 1,147,427

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 1069 msgs (95.36%), $1217.2488 (99.52%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 52 msgs (4.64%), $5.8316 (0.48%)

## Conversation Shape

- user_msg_count: 119
- user_msg_avg_len: 792
- turns_before_first_tool: 2
- compaction_count: 3
- skill_invocations: 0
- subagent_dispatches: 23

## Tool Usage

- Bash: 277 (14 failed)
- Edit: 56 (5 failed)
- Read: 45 (11 failed)
- Agent: 23
- AskUserQuestion: 19 (10 failed)
- Grep: 16 (1 failed)
- Monitor: 14
- TaskCreate: 14
- Write: 12
- TaskUpdate: 12
- Glob: 10
- SendMessage: 6
- WebFetch: 5
- ToolSearch: 4
- TaskStop: 2
- ScheduleWakeup: 1

## Tool Result Sizes (bytes)

- count: 516
- sum: 395,733
- p50: 291
- p90: 1,518
- max: 25,266

## File Re-reads

- redundant_read_count: 5
- top paths:
  - 3× C:\work\mega\w-memory-w2c2\src\AstraMemory.Infrastructure\Repositories\MemoryRepository.cs
  - 3× C:\work\mega\w-memory-w2c2\tests\AstraMemory.Tests\Api\DashboardControllerTests.cs
  - 2× C:\work\mega\sales\tests\Sales.Api.Tests\Controllers\DiscoveryConfigControllerTests.cs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 276 calls, 232,769B results, ~7,282,293 cache_create tok (31.29×)
- TaskCreate: 14 calls, 1,033B results, ~1,848,423 cache_create tok (1789.37×)
- Glob: 10 calls, 215B results, ~723,592 cache_create tok (3365.54×)
- ToolSearch: 4 calls, 305B results, ~573,440 cache_create tok (1880.13×)
- AskUserQuestion: 19 calls, 9,773B results, ~493,431 cache_create tok (50.49×)
- Grep: 16 calls, 20,883B results, ~333,972 cache_create tok (15.99×)
- Read: 45 calls, 67,300B results, ~297,267 cache_create tok (4.42×)
- Agent: 23 calls, 19,864B results, ~163,810 cache_create tok (8.25×)
- Edit: 56 calls, 9,421B results, ~125,499 cache_create tok (13.32×)
- Write: 12 calls, 2,069B results, ~100,002 cache_create tok (48.33×)
- SendMessage: 6 calls, 2,272B results, ~46,901 cache_create tok (20.64×)
- TaskUpdate: 12 calls, 332B results, ~38,235 cache_create tok (115.17×)
- Monitor: 14 calls, 2,916B results, ~26,515 cache_create tok (9.09×)
- WebFetch: 5 calls, 8,092B results, ~12,657 cache_create tok (1.56×)
- TaskStop: 2 calls, 2,732B results, ~4,930 cache_create tok (1.8×)
- ScheduleWakeup: 1 calls, 157B results, ~1,372 cache_create tok (8.74×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 52
- usd: $5.8316
- input: 116
- cache_create_5m: 0
- cache_create_1h: 834,200
- cache_read: 1,316,219
- output: 28,746

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 1069
- usd: $1217.2488
- input: 3,833
- cache_create_5m: 0
- cache_create_1h: 11,316,523
- cache_read: 529,196,357
- output: 1,118,681

