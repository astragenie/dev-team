---
kind: cost-report
feature: FEAT-146
run_title: "FEAT146 SLICE67"
usd: 694.9161
duration_ms: 200111872
total_tokens: 313344024
cache_hit_pct: 98.1
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-11T06:19:33.346Z
---

# Cost Report: FEAT146 SLICE67

- Created: 2026-06-11T06:19:33.346Z
- Run Title: FEAT146 SLICE67
- Window Start: 2026-06-08T22:44:20.774Z
- Window End: 2026-06-11T06:19:32.646Z
- Duration: 3335.2 min (200111872 ms)
- Sessions Scanned: 6
- Assistant Messages Counted: 1405
- Total Tokens: 313,344,024
- Cache Hit %: 98.1%
- Total USD: $694.9161
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 2,559
- cache_create_5m: 0
- cache_create_1h: 5,935,005
- cache_read: 306,205,901
- output: 1,200,559

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 1263 msgs (89.89%), $686.7853 (98.83%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 142 msgs (10.11%), $8.1308 (1.17%)

## Conversation Shape

- user_msg_count: 85
- user_msg_avg_len: 518
- turns_before_first_tool: 1
- compaction_count: 26
- skill_invocations: 3
- subagent_dispatches: 19

## Tool Usage

- Bash: 294 (8 failed)
- Edit: 191 (19 failed)
- Read: 126
- Grep: 73
- TaskUpdate: 20
- Agent: 19
- TaskCreate: 14
- Write: 13
- Glob: 12
- AskUserQuestion: 12 (2 failed)
- ToolSearch: 5
- ExitPlanMode: 3
- Skill: 3
- EnterPlanMode: 2
- PowerShell: 2

## Tool Result Sizes (bytes)

- count: 789
- sum: 893,078
- p50: 160
- p90: 2,430
- max: 60,665

## File Re-reads

- redundant_read_count: 73
- top paths:
  - 14× C:\work\mega\hero-crew\agents\builder.md
  - 8× C:\work\mega\hero-crew\agents\lead.md
  - 7× C:\work\mega\hero-crew\agents\builder-fe.md
  - 7× C:\work\mega\hero-crew\agents\builder-be.md
  - 7× C:\work\mega\hero-crew\scripts\crew.ts

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Read: 126 calls, 526,100B results, ~1,878,942 cache_create tok (3.57×)
- Edit: 191 calls, 28,650B results, ~1,319,760 cache_create tok (46.06×)
- Bash: 293 calls, 230,655B results, ~1,136,031 cache_create tok (4.93×)
- TaskUpdate: 20 calls, 452B results, ~791,281 cache_create tok (1750.62×)
- ToolSearch: 5 calls, 369B results, ~236,155 cache_create tok (639.99×)
- Agent: 19 calls, 33,270B results, ~119,953 cache_create tok (3.61×)
- Grep: 73 calls, 28,157B results, ~117,536 cache_create tok (4.17×)
- Write: 13 calls, 2,205B results, ~63,222 cache_create tok (28.67×)
- AskUserQuestion: 12 calls, 3,023B results, ~57,027 cache_create tok (18.86×)
- ExitPlanMode: 3 calls, 26,019B results, ~30,075 cache_create tok (1.16×)
- Glob: 12 calls, 11,846B results, ~27,831 cache_create tok (2.35×)
- EnterPlanMode: 2 calls, 1,162B results, ~22,299 cache_create tok (19.19×)
- Skill: 3 calls, 126B results, ~21,188 cache_create tok (168.16×)
- TaskCreate: 14 calls, 794B results, ~3,523 cache_create tok (4.44×)
- PowerShell: 2 calls, 233B results, ~3,176 cache_create tok (13.63×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 1263
- usd: $686.7853
- input: 2,381
- cache_create_5m: 0
- cache_create_1h: 5,617,055
- cache_read: 290,017,939
- output: 1,109,481

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 142
- usd: $8.1308
- input: 178
- cache_create_5m: 0
- cache_create_1h: 317,950
- cache_read: 16,187,962
- output: 91,078

