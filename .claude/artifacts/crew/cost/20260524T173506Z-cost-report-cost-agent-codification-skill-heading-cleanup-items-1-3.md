---
kind: cost-report
feature: agent-codification
run_title: "Agent codification + skill heading cleanup (items 1-3)"
usd: 223.526
duration_ms: 5275041
total_tokens: 165969426
cache_hit_pct: 98.6
source_project: aggregate
aggregate_all: true
source_count: 6
created_at: 2026-05-24T17:35:06.765Z
---

# Cost Report: Cost — Agent codification + skill heading cleanup (items 1-3)

- Created: 2026-05-24T17:35:06.765Z
- Run Title: Agent codification + skill heading cleanup (items 1-3)
- Window Start: 2026-05-24T16:07:11.072Z
- Window End: 2026-05-24T17:35:06.113Z
- Duration: 87.9 min (5275041 ms)
- Sessions Scanned: 6
- Assistant Messages Counted: 1159
- Total Tokens: 165,969,426
- Cache Hit %: 98.6%
- Total USD: $223.5260
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-AstraGenie-Common: 119 msgs, $77.2780
- C--work-mega-AstraGenie-CityLive: 181 msgs, $64.4553
- C--work-mega-hero-crew: 89 msgs, $45.4816
- C--work-mega-AstraGenie-MemoryService: 391 msgs, $18.9221
- C--work-mega-Astra-LoopObserver: 299 msgs, $13.0588
- C--work-mega-hero-crew-autonomous-loop: 80 msgs, $4.3303

## Tokens (totals)

- input: 3,137
- cache_create_5m: 0
- cache_create_1h: 2,350,697
- cache_read: 162,897,504
- output: 718,088

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 389 msgs (33.56%), $187.2148 (83.76%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 770 msgs (66.44%), $36.3112 (16.24%)

## Conversation Shape

- user_msg_count: 66
- user_msg_avg_len: 1120
- turns_before_first_tool: 1
- compaction_count: 11
- skill_invocations: 3
- subagent_dispatches: 12

## Tool Usage

- Bash: 325 (36 failed)
- Read: 100
- Edit: 67 (1 failed)
- TaskUpdate: 34
- Glob: 26
- TaskCreate: 20
- PowerShell: 16 (4 failed)
- Write: 13
- Agent: 12
- ToolSearch: 12
- Grep: 10
- mcp__plugin_playwright_playwright__browser_take_screenshot: 8
- mcp__plugin_playwright_playwright__browser_navigate: 7
- Skill: 3
- mcp__plugin_playwright_playwright__browser_click: 3 (1 failed)
- mcp__plugin_playwright_playwright__browser_snapshot: 2
- mcp__plugin_playwright_playwright__browser_console_messages: 2
- mcp__plugin_azure_azure__compute: 2
- AskUserQuestion: 1
- EnterPlanMode: 1
- mcp__plugin_playwright_playwright__browser_evaluate: 1

## Tool Result Sizes (bytes)

- count: 670
- sum: 2,354,449
- p50: 243
- p90: 3,313
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

- Bash: 328 calls, 340,443B results, ~902,505 cache_create tok (2.65×)
- Read: 101 calls, 427,333B results, ~529,376 cache_create tok (1.24×)
- TaskCreate: 20 calls, 1,244B results, ~219,797 cache_create tok (176.69×)
- ToolSearch: 12 calls, 1,679B results, ~124,992 cache_create tok (74.44×)
- Edit: 67 calls, 11,909B results, ~107,541 cache_create tok (9.03×)
- Agent: 11 calls, 33,372B results, ~100,081 cache_create tok (3×)
- Glob: 27 calls, 42,435B results, ~98,802 cache_create tok (2.33×)
- mcp__plugin_playwright_playwright__browser_take_screenshot: 8 calls, 1,414,662B results, ~74,402 cache_create tok (0.05×)
- TaskUpdate: 34 calls, 764B results, ~49,380 cache_create tok (64.63×)
- mcp__plugin_azure_azure__compute: 2 calls, 51,127B results, ~40,059 cache_create tok (0.78×)
- Write: 13 calls, 2,364B results, ~34,683 cache_create tok (14.67×)
- Grep: 10 calls, 10,921B results, ~26,080 cache_create tok (2.39×)
- PowerShell: 16 calls, 4,018B results, ~9,525 cache_create tok (2.37×)
- Skill: 3 calls, 82B results, ~7,060 cache_create tok (86.1×)
- EnterPlanMode: 1 calls, 581B results, ~5,160 cache_create tok (8.88×)
- mcp__plugin_playwright_playwright__browser_snapshot: 2 calls, 3,440B results, ~4,581 cache_create tok (1.33×)
- AskUserQuestion: 1 calls, 377B results, ~4,534 cache_create tok (12.03×)
- mcp__plugin_playwright_playwright__browser_navigate: 7 calls, 3,115B results, ~4,317 cache_create tok (1.39×)
- mcp__plugin_playwright_playwright__browser_console_messages: 2 calls, 2,875B results, ~3,651 cache_create tok (1.27×)
- mcp__plugin_playwright_playwright__browser_click: 3 calls, 1,137B results, ~793 cache_create tok (0.7×)
- mcp__plugin_playwright_playwright__browser_evaluate: 1 calls, 293B results, ~178 cache_create tok (0.61×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 770
- usd: $36.3112
- input: 1,048
- cache_create_5m: 0
- cache_create_1h: 1,255,943
- cache_read: 80,407,996
- output: 310,000

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 389
- usd: $187.2148
- input: 2,089
- cache_create_5m: 0
- cache_create_1h: 1,094,754
- cache_read: 82,489,508
- output: 408,088

