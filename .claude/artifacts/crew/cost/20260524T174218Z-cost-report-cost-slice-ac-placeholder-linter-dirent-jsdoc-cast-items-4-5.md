---
kind: cost-report
feature: slice-linter
run_title: "Slice AC-placeholder linter + Dirent JSDoc cast (items 4+5)"
usd: 253.5034
duration_ms: 5706940
total_tokens: 183741441
cache_hit_pct: 98.6
source_project: aggregate
aggregate_all: true
source_count: 6
created_at: 2026-05-24T17:42:18.653Z
---

# Cost Report: Cost — Slice AC-placeholder linter + Dirent JSDoc cast (items 4+5)

- Created: 2026-05-24T17:42:18.653Z
- Run Title: Slice AC-placeholder linter + Dirent JSDoc cast (items 4+5)
- Window Start: 2026-05-24T16:07:11.072Z
- Window End: 2026-05-24T17:42:18.012Z
- Duration: 95.1 min (5706940 ms)
- Sessions Scanned: 6
- Assistant Messages Counted: 1258
- Total Tokens: 183,741,441
- Cache Hit %: 98.6%
- Total USD: $253.5034
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-AstraGenie-Common: 126 msgs, $84.1198
- C--work-mega-AstraGenie-CityLive: 186 msgs, $66.2549
- C--work-mega-hero-crew: 127 msgs, $65.3481
- C--work-mega-AstraGenie-MemoryService: 400 msgs, $19.1882
- C--work-mega-Astra-LoopObserver: 339 msgs, $14.2621
- C--work-mega-hero-crew-autonomous-loop: 80 msgs, $4.3303

## Tokens (totals)

- input: 3,260
- cache_create_5m: 0
- cache_create_1h: 2,476,139
- cache_read: 180,467,490
- output: 794,552

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 439 msgs (34.9%), $215.7228 (85.1%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 819 msgs (65.1%), $37.7806 (14.9%)

## Conversation Shape

- user_msg_count: 68
- user_msg_avg_len: 1087
- turns_before_first_tool: 1
- compaction_count: 11
- skill_invocations: 3
- subagent_dispatches: 17

## Tool Usage

- Bash: 354 (37 failed)
- Read: 106
- Edit: 71 (1 failed)
- TaskUpdate: 34
- PowerShell: 29 (9 failed)
- Glob: 26
- TaskCreate: 20
- Agent: 17
- Write: 15
- ToolSearch: 12
- Grep: 10
- mcp__plugin_playwright_playwright__browser_take_screenshot: 8
- mcp__plugin_playwright_playwright__browser_navigate: 7
- Skill: 3
- mcp__plugin_playwright_playwright__browser_click: 3 (1 failed)
- mcp__plugin_playwright_playwright__browser_snapshot: 2
- mcp__plugin_playwright_playwright__browser_console_messages: 2
- AskUserQuestion: 2
- mcp__plugin_azure_azure__compute: 2
- EnterPlanMode: 1
- mcp__plugin_playwright_playwright__browser_evaluate: 1

## Tool Result Sizes (bytes)

- count: 730
- sum: 2,399,473
- p50: 268
- p90: 3,280
- max: 637,375

## File Re-reads

- redundant_read_count: 16
- top paths:
  - 3× C:\work\mega\Astra.LoopObserver\infra\terraform\main.tf
  - 3× C:\work\mega\AstraGenie.Common\src\AstraGenie.Gateway.Api\appsettings.yarp.AzureDev.json
  - 3× C:\work\mega\AstraGenie.MemoryService\.claude\crew\deployment.md
  - 3× C:\work\mega\hero-crew-autonomous-loop\scripts\lib\stop-conditions.mjs
  - 3× C:\work\mega\hero-crew-autonomous-loop\scripts\lib\slice-linker.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 357 calls, 354,886B results, ~852,334 cache_create tok (2.4×)
- Read: 107 calls, 434,451B results, ~546,331 cache_create tok (1.26×)
- Agent: 16 calls, 45,710B results, ~224,985 cache_create tok (4.92×)
- TaskCreate: 20 calls, 1,244B results, ~219,797 cache_create tok (176.69×)
- ToolSearch: 12 calls, 1,679B results, ~124,992 cache_create tok (74.44×)
- Edit: 71 calls, 12,523B results, ~110,149 cache_create tok (8.8×)
- Glob: 27 calls, 42,435B results, ~98,802 cache_create tok (2.33×)
- mcp__plugin_playwright_playwright__browser_take_screenshot: 8 calls, 1,414,662B results, ~74,402 cache_create tok (0.05×)
- TaskUpdate: 34 calls, 764B results, ~49,380 cache_create tok (64.63×)
- Write: 15 calls, 2,659B results, ~41,620 cache_create tok (15.65×)
- mcp__plugin_azure_azure__compute: 2 calls, 51,127B results, ~40,059 cache_create tok (0.78×)
- Grep: 10 calls, 10,921B results, ~26,080 cache_create tok (2.39×)
- PowerShell: 29 calls, 13,886B results, ~24,094 cache_create tok (1.74×)
- AskUserQuestion: 2 calls, 725B results, ~9,694 cache_create tok (13.37×)
- EnterPlanMode: 1 calls, 581B results, ~9,640 cache_create tok (16.59×)
- Skill: 3 calls, 82B results, ~7,060 cache_create tok (86.1×)
- mcp__plugin_playwright_playwright__browser_snapshot: 2 calls, 3,440B results, ~4,581 cache_create tok (1.33×)
- mcp__plugin_playwright_playwright__browser_navigate: 7 calls, 3,115B results, ~4,317 cache_create tok (1.39×)
- mcp__plugin_playwright_playwright__browser_console_messages: 2 calls, 2,875B results, ~3,651 cache_create tok (1.27×)
- mcp__plugin_playwright_playwright__browser_click: 3 calls, 1,137B results, ~793 cache_create tok (0.7×)
- mcp__plugin_playwright_playwright__browser_evaluate: 1 calls, 293B results, ~178 cache_create tok (0.61×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 819
- usd: $37.7806
- input: 1,101
- cache_create_5m: 0
- cache_create_1h: 1,287,782
- cache_read: 83,966,186
- output: 324,049

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 439
- usd: $215.7228
- input: 2,159
- cache_create_5m: 0
- cache_create_1h: 1,188,357
- cache_read: 96,501,304
- output: 470,503

