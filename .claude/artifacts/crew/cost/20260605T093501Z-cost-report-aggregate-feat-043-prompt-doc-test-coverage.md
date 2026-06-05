---
kind: cost-report
run_title: "FEAT-043: prompt/doc test coverage"
usd: 19.1841
duration_ms: 904724
total_tokens: 41451395
cache_hit_pct: 98.4
source_project: aggregate
aggregate_all: true
source_count: 3
created_at: 2026-06-05T09:35:01.162Z
---

# Cost Report: FEAT-043: prompt/doc test coverage

- Created: 2026-06-05T09:35:01.162Z
- Run Title: FEAT-043: prompt/doc test coverage
- Window Start: 2026-06-05T09:19:54.071Z
- Window End: 2026-06-05T09:34:58.795Z
- Duration: 15.1 min (904724 ms)
- Sessions Scanned: 4
- Assistant Messages Counted: 333
- Total Tokens: 41,451,395
- Cache Hit %: 98.4%
- Total USD: $19.1841
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-hero-crew: 180 msgs, $12.2192
- C--work-mega-loopobserver: 71 msgs, $3.8219
- C--work-mega-loop: 82 msgs, $3.1429

## Tokens (totals)

- input: 387
- cache_create_5m: 0
- cache_create_1h: 660,883
- cache_read: 40,587,366
- output: 202,759

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 333 msgs (100%), $19.1841 (100%)

## Conversation Shape

- user_msg_count: 2
- user_msg_avg_len: 7739
- turns_before_first_tool: 1
- compaction_count: 2
- skill_invocations: 1
- subagent_dispatches: 2

## Tool Usage

- Bash: 134 (1 failed)
- Read: 27
- Edit: 15
- PowerShell: 7 (1 failed)
- Write: 6
- mcp__plugin_playwright_playwright__browser_navigate: 4
- mcp__plugin_playwright_playwright__browser_take_screenshot: 4
- mcp__plugin_playwright_playwright__browser_evaluate: 4
- mcp__plugin_playwright_playwright__browser_console_messages: 3
- Agent: 2
- Glob: 2
- mcp__plugin_playwright_playwright__browser_hover: 2 (1 failed)
- Skill: 1
- Grep: 1
- ToolSearch: 1

## Tool Result Sizes (bytes)

- count: 215
- sum: 452,337
- p50: 396
- p90: 2,157
- max: 92,688

## File Re-reads

- redundant_read_count: 4
- top paths:
  - 4× C:\work\mega\loop\src\scripts\lib\pm-scorer.mts
  - 2× C:/work/mega/hero-crew/hooks/check-redundant-read.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 134 calls, 94,822B results, ~296,874 cache_create tok (3.13×)
- Write: 6 calls, 1,050B results, ~235,368 cache_create tok (224.16×)
- Read: 27 calls, 327,887B results, ~70,771 cache_create tok (0.22×)
- Edit: 15 calls, 2,433B results, ~17,597 cache_create tok (7.23×)
- Agent: 2 calls, 2,899B results, ~12,318 cache_create tok (4.25×)
- PowerShell: 7 calls, 4,546B results, ~6,627 cache_create tok (1.46×)
- Skill: 1 calls, 42B results, ~5,160 cache_create tok (122.86×)
- mcp__plugin_playwright_playwright__browser_evaluate: 4 calls, 1,807B results, ~4,262 cache_create tok (2.36×)
- mcp__plugin_playwright_playwright__browser_console_messages: 3 calls, 1,594B results, ~3,127 cache_create tok (1.96×)
- Grep: 1 calls, 1,190B results, ~2,466 cache_create tok (2.07×)
- mcp__plugin_playwright_playwright__browser_navigate: 4 calls, 1,598B results, ~2,042 cache_create tok (1.28×)
- mcp__plugin_playwright_playwright__browser_take_screenshot: 4 calls, 1,608B results, ~1,321 cache_create tok (0.82×)
- Glob: 2 calls, 155B results, ~1,066 cache_create tok (6.88×)
- mcp__plugin_playwright_playwright__browser_hover: 2 calls, 1,075B results, ~649 cache_create tok (0.6×)
- ToolSearch: 1 calls, 90B results, ~253 cache_create tok (2.81×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 333
- usd: $19.1841
- input: 387
- cache_create_5m: 0
- cache_create_1h: 660,883
- cache_read: 40,587,366
- output: 202,759

