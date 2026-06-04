---
kind: cost-report
run_title: "v0.8.0 release polish — superseded by v0.10.0"
usd: 424.5245
duration_ms: 23801398
total_tokens: 176615486
cache_hit_pct: 97.7
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-04T19:56:41.904Z
---

# Cost Report: v0.8.0 release polish — superseded by v0.10.0

- Created: 2026-06-04T19:56:41.904Z
- Run Title: v0.8.0 release polish — superseded by v0.10.0
- Window Start: 2026-06-04T13:20:00.285Z
- Window End: 2026-06-04T19:56:41.683Z
- Duration: 396.7 min (23801398 ms)
- Sessions Scanned: 3
- Assistant Messages Counted: 570
- Total Tokens: 176,615,486
- Cache Hit %: 97.7%
- Total USD: $424.5245
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 2,358
- cache_create_5m: 0
- cache_create_1h: 4,026,416
- cache_read: 171,976,963
- output: 609,749

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 570 msgs (100%), $424.5245 (100%)

## Conversation Shape

- user_msg_count: 40
- user_msg_avg_len: 128
- turns_before_first_tool: 1
- compaction_count: 36
- skill_invocations: 1
- subagent_dispatches: 7

## Tool Usage

- Bash: 103 (1 failed)
- Edit: 57 (8 failed)
- Read: 56 (2 failed)
- TaskUpdate: 17
- Grep: 15
- AskUserQuestion: 10
- Write: 10
- TaskCreate: 9
- Agent: 7
- Glob: 3
- PowerShell: 1
- ToolSearch: 1
- Skill: 1

## Tool Result Sizes (bytes)

- count: 291
- sum: 345,913
- p50: 249
- p90: 2,904
- max: 59,928

## File Re-reads

- redundant_read_count: 11
- top paths:
  - 5× C:\work\mega\hero-crew\agents\lead.md
  - 3× C:\work\mega\loop\src\tests\slice-linker.test.mts
  - 2× C:\work\mega\hero-crew\package.json
  - 2× C:\work\mega\hero-crew\.claude-plugin\plugin.json
  - 2× C:\work\mega\hero-crew\.claude-plugin\marketplace.json

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- TaskCreate: 9 calls, 585B results, ~1,448,326 cache_create tok (2475.77×)
- Bash: 103 calls, 71,986B results, ~1,328,475 cache_create tok (18.45×)
- ToolSearch: 1 calls, 152B results, ~361,592 cache_create tok (2378.89×)
- Read: 56 calls, 211,948B results, ~333,706 cache_create tok (1.57×)
- Agent: 7 calls, 21,831B results, ~115,703 cache_create tok (5.3×)
- Edit: 57 calls, 8,811B results, ~70,729 cache_create tok (8.03×)
- Grep: 15 calls, 23,564B results, ~65,593 cache_create tok (2.78×)
- Write: 10 calls, 1,983B results, ~63,606 cache_create tok (32.08×)
- TaskUpdate: 17 calls, 374B results, ~40,099 cache_create tok (107.22×)
- AskUserQuestion: 10 calls, 2,198B results, ~36,423 cache_create tok (16.57×)
- Skill: 1 calls, 42B results, ~7,542 cache_create tok (179.57×)
- Glob: 3 calls, 2,140B results, ~6,790 cache_create tok (3.17×)
- PowerShell: 1 calls, 44B results, ~2,328 cache_create tok (52.91×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 570
- usd: $424.5245
- input: 2,358
- cache_create_5m: 0
- cache_create_1h: 4,026,416
- cache_read: 171,976,963
- output: 609,749

