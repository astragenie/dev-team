---
kind: cost-report
feature: FEAT-159
run_title: "FEAT159 SLICE84"
usd: 456.9
duration_ms: 1870688
total_tokens: 274143088
cache_hit_pct: 99.5
source_project: aggregate
aggregate_all: true
source_count: 5
created_at: 2026-06-20T08:56:02.331Z
---

# Cost Report: FEAT159 SLICE84

- Created: 2026-06-20T08:56:02.331Z
- Run Title: FEAT159 SLICE84
- Window Start: 2026-06-20T08:24:44.706Z
- Window End: 2026-06-20T08:55:55.394Z
- Duration: 31.2 min (1870688 ms)
- Sessions Scanned: 6
- Assistant Messages Counted: 576
- Total Tokens: 274,143,088
- Cache Hit %: 99.5%
- Total USD: $456.9000
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-devops: 136 msgs, $160.6674
- C--work-mega-memory: 229 msgs, $155.0369
- C--work-mega: 89 msgs, $60.5533
- C--work-mega-loop: 43 msgs, $44.6927
- C--work-mega-hero-crew: 79 msgs, $35.9497

## Tokens (totals)

- input: 34,364
- cache_create_5m: 0
- cache_create_1h: 1,257,241
- cache_read: 272,265,591
- output: 585,892

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 448 msgs (77.78%), $448.4818 (98.16%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 128 msgs (22.22%), $8.4182 (1.84%)

## Conversation Shape

- user_msg_count: 29
- user_msg_avg_len: 1341
- turns_before_first_tool: 2
- compaction_count: 3
- skill_invocations: 0
- subagent_dispatches: 11

## Tool Usage

- Bash: 151 (3 failed)
- Read: 75 (1 failed)
- Edit: 41 (6 failed)
- TaskUpdate: 24
- Write: 16 (1 failed)
- TaskCreate: 13
- PowerShell: 12 (4 failed)
- Agent: 11
- Grep: 7
- Glob: 5
- AskUserQuestion: 4
- ToolSearch: 1
- ExitPlanMode: 1

## Tool Result Sizes (bytes)

- count: 370
- sum: 443,424
- p50: 377
- p90: 3,414
- max: 15,688

## File Re-reads

- redundant_read_count: 19
- top paths:
  - 4× C:\work\mega\memory\src\AstraMemory.Infrastructure\VectorStore\PgVectorStore.cs
  - 3× C:\work\mega\memory-ci-fix\tests\AstraMemory.Tests\Api\AdminControllerTestFactory.cs
  - 3× C:\work\mega\memory\src\AstraMemory.Infrastructure\Repositories\MemoryRepository.cs
  - 2× C:/work/mega/sales/src/Sales.Api/Controllers/SourcesController.cs
  - 2× C:\work\mega\marketing\.github\workflows\build-push-csharp.yml

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 158 calls, 141,833B results, ~458,147 cache_create tok (3.23×)
- Read: 76 calls, 204,983B results, ~321,242 cache_create tok (1.57×)
- Agent: 10 calls, 21,765B results, ~109,468 cache_create tok (5.03×)
- Edit: 41 calls, 6,752B results, ~87,459 cache_create tok (12.95×)
- TaskUpdate: 23 calls, 530B results, ~78,441 cache_create tok (148×)
- Write: 16 calls, 2,571B results, ~62,203 cache_create tok (24.19×)
- TaskCreate: 13 calls, 932B results, ~49,605 cache_create tok (53.22×)
- Grep: 7 calls, 17,200B results, ~32,942 cache_create tok (1.92×)
- PowerShell: 12 calls, 5,898B results, ~15,848 cache_create tok (2.69×)
- ExitPlanMode: 1 calls, 12,912B results, ~11,596 cache_create tok (0.9×)
- AskUserQuestion: 4 calls, 827B results, ~10,890 cache_create tok (13.17×)
- Glob: 5 calls, 2,246B results, ~8,927 cache_create tok (3.97×)
- ToolSearch: 1 calls, 54B results, ~2,070 cache_create tok (38.33×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 448
- usd: $448.4818
- input: 16,152
- cache_create_5m: 0
- cache_create_1h: 865,892
- cache_read: 257,798,441
- output: 474,201

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 128
- usd: $8.4182
- input: 18,212
- cache_create_5m: 0
- cache_create_1h: 391,349
- cache_read: 14,467,150
- output: 111,691

