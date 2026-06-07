---
kind: cost-report
slice: SLICE-40
run_title: "SLICE-40: cost-advisor stack .mjs → .ts"
usd: 52.9612
duration_ms: 1485632
total_tokens: 38898286
cache_hit_pct: 99.2
review_decision: approved
source_project: aggregate
aggregate_all: true
source_count: 3
created_at: 2026-06-07T14:37:20.456Z
---

# Cost Report: SLICE-40: cost-advisor stack .mjs → .ts

- Created: 2026-06-07T14:37:20.456Z
- Run Title: SLICE-40: cost-advisor stack .mjs → .ts
- Window Start: 2026-06-07T14:12:30.486Z
- Window End: 2026-06-07T14:37:16.118Z
- Duration: 24.8 min (1485632 ms)
- Sessions Scanned: 4
- Assistant Messages Counted: 146
- Total Tokens: 38,898,286
- Cache Hit %: 99.2%
- Total USD: $52.9612
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-loopobserver: 65 msgs, $46.9215
- C--work-mega-loop: 45 msgs, $3.3754
- C--work-mega-hero-crew: 36 msgs, $2.6643

## Outcome Linkage

- Slice: SLICE-40
- Grade Avg: -
- Review Decision: approved
- Validation Decision: -

## Tokens (totals)

- input: 266
- cache_create_5m: 0
- cache_create_1h: 299,340
- cache_read: 38,502,917
- output: 95,763

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 67 msgs (45.89%), $47.7213 (90.11%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 79 msgs (54.11%), $5.2399 (9.89%)

## Conversation Shape

- user_msg_count: 5
- user_msg_avg_len: 2555
- turns_before_first_tool: 0
- compaction_count: 2
- skill_invocations: 2
- subagent_dispatches: 10

## Tool Usage

- Bash: 43 (3 failed)
- Agent: 10
- Read: 9
- mcp__plugin_playwright_playwright__browser_navigate: 6
- mcp__plugin_playwright_playwright__browser_console_messages: 5
- mcp__plugin_playwright_playwright__browser_take_screenshot: 5
- Write: 3
- Edit: 2
- AskUserQuestion: 2
- Skill: 2

## Tool Result Sizes (bytes)

- count: 87
- sum: 103,897
- p50: 500
- p90: 2,368
- max: 10,228

## File Re-reads

- redundant_read_count: 2
- top paths:
  - 2× C:\work\mega\hero-crew\scripts\lib\session-cost.ts
  - 2× C:\work\mega\loop\src\scripts\lib\backlog-parser.mts

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Agent: 9 calls, 21,124B results, ~148,526 cache_create tok (7.03×)
- Bash: 42 calls, 50,277B results, ~82,128 cache_create tok (1.63×)
- Read: 9 calls, 22,940B results, ~26,699 cache_create tok (1.16×)
- mcp__plugin_playwright_playwright__browser_navigate: 6 calls, 2,608B results, ~11,553 cache_create tok (4.43×)
- Write: 3 calls, 587B results, ~9,318 cache_create tok (15.87×)
- mcp__plugin_playwright_playwright__browser_console_messages: 5 calls, 2,119B results, ~6,106 cache_create tok (2.88×)
- Skill: 2 calls, 69B results, ~5,930 cache_create tok (85.94×)
- mcp__plugin_playwright_playwright__browser_take_screenshot: 5 calls, 1,491B results, ~4,368 cache_create tok (2.93×)
- Edit: 2 calls, 382B results, ~3,180 cache_create tok (8.32×)
- AskUserQuestion: 2 calls, 334B results, ~1,318 cache_create tok (3.95×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 79
- usd: $5.2399
- input: 99
- cache_create_5m: 0
- cache_create_1h: 210,957
- cache_read: 10,551,292
- output: 53,898

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 67
- usd: $47.7213
- input: 167
- cache_create_5m: 0
- cache_create_1h: 88,383
- cache_read: 27,951,625
- output: 41,865

