---
kind: cost-report
slice: SLICE-08
run_title: "SLICE-08 complete + v0.3.10 release + lead-involvement spec"
usd: 282.4397
duration_ms: 7023189
total_tokens: 272517745
cache_hit_pct: 98.0
validation_decision: passed_with_notes
source_project: aggregate
aggregate_all: true
source_count: 4
created_at: 2026-05-28T17:28:31.901Z
---

# Cost Report: SLICE-08 complete + v0.3.10 release + lead-involvement spec

- Created: 2026-05-28T17:28:31.901Z
- Run Title: SLICE-08 complete + v0.3.10 release + lead-involvement spec
- Window Start: 2026-05-28T15:31:27.373Z
- Window End: 2026-05-28T17:28:30.562Z
- Duration: 117.1 min (7023189 ms)
- Sessions Scanned: 7
- Assistant Messages Counted: 2197
- Total Tokens: 272,517,745
- Cache Hit %: 98.0%
- Total USD: $282.4397
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-AstraGenie-MemoryService: 719 msgs, $118.5371
- C--work-mega-Astra-Humanizer: 502 msgs, $104.9518
- C--work-mega-hero-crew: 472 msgs, $31.6363
- C--work-mega-hero-crew-autonomous-loop: 504 msgs, $27.3144

## Outcome Linkage

- Slice: SLICE-08
- Grade Avg: -
- Review Decision: -
- Validation Decision: passed_with_notes

## Tokens (totals)

- input: 18,514
- cache_create_5m: 0
- cache_create_1h: 5,271,629
- cache_read: 265,702,159
- output: 1,525,443

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 468 msgs (21.3%), $185.2026 (65.57%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 1729 msgs (78.7%), $97.2371 (34.43%)

## Conversation Shape

- user_msg_count: 79
- user_msg_avg_len: 1804
- turns_before_first_tool: 1
- compaction_count: 34
- skill_invocations: 7
- subagent_dispatches: 49

## Tool Usage

- Bash: 566 (34 failed)
- Read: 303 (5 failed)
- Edit: 249 (4 failed)
- Write: 67 (4 failed)
- Agent: 49
- Grep: 33
- Glob: 27
- TaskUpdate: 22
- PowerShell: 11
- Skill: 7 (2 failed)
- TaskCreate: 7
- ToolSearch: 5
- AskUserQuestion: 1
- ExitPlanMode: 1

## Tool Result Sizes (bytes)

- count: 1358
- sum: 1,877,481
- p50: 267
- p90: 2,993
- max: 60,960

## File Re-reads

- redundant_read_count: 114
- top paths:
  - 18× C:\work\mega\hero-crew-autonomous-loop\scripts\lib\slice-linker.mjs
  - 11× C:\work\mega\Astra.Humanizer\docs\superpowers\plans\2026-05-28-portal-stealth-redesign.md
  - 7× C:\work\mega\AstraGenie.MemoryService\src\frontend\memory-dashboard\src\pages\NotebookWorkspacePage.tsx
  - 6× C:\work\mega\AstraGenie.MemoryService\src\frontend\memory-dashboard\src\api\memoryApi.ts
  - 6× C:\work\mega\AstraGenie.MemoryService\src\MemoryService.Api\Controllers\MemoriesController.cs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 572 calls, 588,609B results, ~1,793,240 cache_create tok (3.05×)
- Read: 305 calls, 1,039,647B results, ~1,375,313 cache_create tok (1.32×)
- Edit: 247 calls, 45,017B results, ~898,585 cache_create tok (19.96×)
- Agent: 49 calls, 124,746B results, ~414,328 cache_create tok (3.32×)
- Write: 67 calls, 13,086B results, ~350,978 cache_create tok (26.82×)
- ToolSearch: 5 calls, 442B results, ~251,931 cache_create tok (569.98×)
- PowerShell: 11 calls, 25,735B results, ~38,630 cache_create tok (1.5×)
- Glob: 27 calls, 15,180B results, ~27,783 cache_create tok (1.83×)
- Grep: 34 calls, 13,063B results, ~20,188 cache_create tok (1.55×)
- TaskUpdate: 22 calls, 519B results, ~11,686 cache_create tok (22.52×)
- Skill: 7 calls, 291B results, ~8,207 cache_create tok (28.2×)
- ExitPlanMode: 1 calls, 5,957B results, ~5,730 cache_create tok (0.96×)
- AskUserQuestion: 1 calls, 321B results, ~5,604 cache_create tok (17.46×)
- TaskCreate: 7 calls, 464B results, ~1,618 cache_create tok (3.49×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 468
- usd: $185.2026
- input: 2,125
- cache_create_5m: 0
- cache_create_1h: 1,409,582
- cache_read: 79,140,299
- output: 322,304

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 1729
- usd: $97.2371
- input: 16,389
- cache_create_5m: 0
- cache_create_1h: 3,862,047
- cache_read: 186,561,860
- output: 1,203,139

