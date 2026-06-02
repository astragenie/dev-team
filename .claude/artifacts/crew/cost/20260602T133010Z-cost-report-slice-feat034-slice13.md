---
kind: cost-report
feature: FEAT-034
run_title: "FEAT034 SLICE13"
usd: 31.6608
duration_ms: 7023189
total_tokens: 52620974
cache_hit_pct: 96.8
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-02T13:30:10.784Z
---

# Cost Report: FEAT034 SLICE13

- Created: 2026-06-02T13:30:10.784Z
- Run Title: FEAT034 SLICE13
- Window Start: 2026-05-28T15:31:27.373Z
- Window End: 2026-05-28T17:28:30.562Z
- Duration: 117.1 min (7023189 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 473
- Total Tokens: 52,620,974
- Cache Hit %: 96.8%
- Total USD: $31.6608
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 2,709
- cache_create_5m: 0
- cache_create_1h: 1,666,653
- cache_read: 50,518,465
- output: 433,147

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 473 msgs (100%), $31.6608 (100%)

## Conversation Shape

- user_msg_count: 22
- user_msg_avg_len: 1949
- turns_before_first_tool: 1
- compaction_count: 12
- skill_invocations: 1
- subagent_dispatches: 10

## Tool Usage

- Edit: 95 (1 failed)
- Bash: 92 (10 failed)
- Read: 59
- Agent: 10
- PowerShell: 10
- TaskUpdate: 10
- TaskCreate: 4
- Write: 2
- Glob: 2
- ToolSearch: 1
- Skill: 1

## Tool Result Sizes (bytes)

- count: 286
- sum: 330,788
- p50: 162
- p90: 2,647
- max: 25,744

## File Re-reads

- redundant_read_count: 25
- top paths:
  - 6× C:\work\mega\hero-crew\scripts\lib\artifacts.mjs
  - 5× C:\work\mega\hero-crew\scripts\lib\session-cost.mjs
  - 5× C:\work\mega\hero-crew\scripts\crew.mjs
  - 4× C:\work\mega\hero-crew\scripts\lib\briefing\collect.mjs
  - 3× C:\work\mega\hero-crew\scripts\lib\installer\global.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Edit: 95 calls, 15,540B results, ~617,828 cache_create tok (39.76×)
- Bash: 91 calls, 92,625B results, ~503,808 cache_create tok (5.44×)
- Read: 59 calls, 184,922B results, ~371,259 cache_create tok (2.01×)
- Agent: 10 calls, 9,084B results, ~108,132 cache_create tok (11.9×)
- PowerShell: 10 calls, 25,388B results, ~36,982 cache_create tok (1.46×)
- Write: 2 calls, 371B results, ~8,995 cache_create tok (24.25×)
- TaskUpdate: 10 calls, 229B results, ~7,094 cache_create tok (30.98×)
- ToolSearch: 1 calls, 152B results, ~4,618 cache_create tok (30.38×)
- Glob: 2 calls, 566B results, ~3,451 cache_create tok (6.1×)
- Skill: 1 calls, 30B results, ~2,446 cache_create tok (81.53×)
- TaskCreate: 4 calls, 285B results, ~564 cache_create tok (1.98×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 473
- usd: $31.6608
- input: 2,709
- cache_create_5m: 0
- cache_create_1h: 1,666,653
- cache_read: 50,518,465
- output: 433,147

