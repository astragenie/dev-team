---
kind: cost-report
run_title: "FEAT-133 split briefing/collect.ts"
usd: 80.5832
duration_ms: 2567702
total_tokens: 40836707
cache_hit_pct: 99.1
source_project: aggregate
aggregate_all: true
source_count: 3
created_at: 2026-06-10T08:36:32.828Z
---

# Cost Report: FEAT-133 split briefing/collect.ts

- Created: 2026-06-10T08:36:32.828Z
- Run Title: FEAT-133 split briefing/collect.ts
- Window Start: 2026-06-10T07:53:40.206Z
- Window End: 2026-06-10T08:36:27.908Z
- Duration: 42.8 min (2567702 ms)
- Sessions Scanned: 4
- Assistant Messages Counted: 195
- Total Tokens: 40,836,707
- Cache Hit %: 99.1%
- Total USD: $80.5832
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-loop: 99 msgs, $35.5467
- C--work-mega-hero-crew: 67 msgs, $29.3671
- C--work-mega-loopobserver: 29 msgs, $15.6693

## Tokens (totals)

- input: 51,366
- cache_create_5m: 0
- cache_create_1h: 319,822
- cache_read: 40,279,184
- output: 186,335

## Model Mix

- claude-opus-4-8 (priced as claude-opus-4): 188 msgs (96.41%), $79.5392 (98.7%)
- claude-fable-5 (priced as claude-sonnet-4): 7 msgs (3.59%), $1.0440 (1.3%)

## Conversation Shape

- user_msg_count: 3
- user_msg_avg_len: 44
- turns_before_first_tool: 2
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 8

## Tool Usage

- Bash: 42 (3 failed)
- Read: 9
- Agent: 8
- Edit: 5 (1 failed)
- PowerShell: 5 (1 failed)
- Write: 3
- ToolSearch: 1
- Grep: 1
- AskUserQuestion: 1

## Tool Result Sizes (bytes)

- count: 75
- sum: 110,146
- p50: 290
- p90: 1,869
- max: 54,281

## File Re-reads

- redundant_read_count: 2
- top paths:
  - 2× C:/work/mega/hero-crew/scripts/lib/briefing/cost.ts
  - 2× C:\work\mega\loop\src\scripts\lib\redundant-read-detector.mts

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 41 calls, 15,911B results, ~108,856 cache_create tok (6.84×)
- Read: 9 calls, 70,212B results, ~81,954 cache_create tok (1.17×)
- Agent: 7 calls, 18,947B results, ~71,854 cache_create tok (3.79×)
- Write: 3 calls, 471B results, ~12,839 cache_create tok (27.26×)
- Edit: 5 calls, 732B results, ~12,362 cache_create tok (16.89×)
- PowerShell: 5 calls, 2,546B results, ~9,898 cache_create tok (3.89×)
- AskUserQuestion: 1 calls, 447B results, ~8,217 cache_create tok (18.38×)
- ToolSearch: 1 calls, 32B results, ~5,679 cache_create tok (177.47×)
- Grep: 1 calls, 253B results, ~2,844 cache_create tok (11.24×)


## By Model (token detail)

### claude-opus-4-8 (priced as claude-opus-4)
- messages: 188
- usd: $79.5392
- input: 15,072
- cache_create_5m: 0
- cache_create_1h: 223,185
- cache_read: 39,768,057
- output: 172,873

### claude-fable-5 (priced as claude-sonnet-4)
- messages: 7
- usd: $1.0440
- input: 36,294
- cache_create_5m: 0
- cache_create_1h: 96,637
- cache_read: 511,127
- output: 13,462

