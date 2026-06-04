---
kind: cost-report
run_title: "Validator Pass-2 edge cases + close 29 skill advisory warnings"
usd: 5959.5882
duration_ms: 596461646
total_tokens: 3174711431
cache_hit_pct: 98.6
source_project: aggregate
aggregate_all: true
source_count: 10
created_at: 2026-06-04T13:12:31.316Z
---

# Cost Report: Validator Pass-2 edge cases + close 29 skill advisory warnings

- Created: 2026-06-04T13:12:31.316Z
- Run Title: Validator Pass-2 edge cases + close 29 skill advisory warnings
- Window Start: 2026-05-28T15:31:27.373Z
- Window End: 2026-06-04T13:12:29.019Z
- Duration: 9941.0 min (596461646 ms)
- Sessions Scanned: 24
- Assistant Messages Counted: 12779
- Total Tokens: 3,174,711,431
- Cache Hit %: 98.6%
- Total USD: $5959.5882
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega: 1641 msgs, $1239.4171
- C--work-mega-hero-crew: 2371 msgs, $1190.4630
- C--work-mega-cortex: 1464 msgs, $1103.8590
- C--work-mega-loopobserver: 1908 msgs, $1051.6616
- C--work-mega-Astra-Humanizer: 1030 msgs, $392.6611
- C--work-mega-AstraGenie-MemoryService: 1112 msgs, $376.1452
- C--work-mega-hero-crew-autonomous-loop: 1859 msgs, $311.6268
- C--work-mega-loop: 312 msgs, $153.8014
- C--work-mega-authentic: 1066 msgs, $129.6169
- C--work-mega-tools: 16 msgs, $10.3363

## Tokens (totals)

- input: 54,844
- cache_create_5m: 0
- cache_create_1h: 45,356,552
- cache_read: 3,120,310,676
- output: 8,989,359

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 9191 msgs (71.92%), $5770.4385 (96.83%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 3588 msgs (28.08%), $189.1497 (3.17%)

## Conversation Shape

- user_msg_count: 608
- user_msg_avg_len: 505
- turns_before_first_tool: 1
- compaction_count: 228
- skill_invocations: 33
- subagent_dispatches: 183

## Tool Usage

- Bash: 3287 (98 failed)
- Read: 1138 (11 failed)
- Edit: 974 (48 failed)
- PowerShell: 347 (69 failed)
- TaskUpdate: 326
- Grep: 288 (3 failed)
- Write: 249 (11 failed)
- Agent: 183
- TaskCreate: 177
- Glob: 155
- mcp__plugin_playwright_playwright__browser_navigate: 100 (12 failed)
- AskUserQuestion: 85 (14 failed)
- ToolSearch: 54
- mcp__plugin_playwright_playwright__browser_snapshot: 43 (3 failed)
- mcp__plugin_playwright_playwright__browser_take_screenshot: 43
- Skill: 33 (2 failed)
- mcp__plugin_playwright_playwright__browser_console_messages: 32
- TaskStop: 25
- mcp__plugin_playwright_playwright__browser_click: 19 (1 failed)
- mcp__plugin_playwright_playwright__browser_fill_form: 10 (1 failed)
- mcp__plugin_playwright_playwright__browser_evaluate: 9 (1 failed)
- mcp__plugin_playwright_playwright__browser_network_requests: 5
- mcp__plugin_playwright_playwright__browser_file_upload: 5 (2 failed)
- mcp__plugin_playwright_playwright__browser_wait_for: 4
- mcp__plugin_playwright_playwright__browser_close: 3
- mcp__plugin_playwright_playwright__browser_type: 2 (2 failed)
- ExitPlanMode: 2
- SendMessage: 1 (1 failed)
- TaskOutput: 1

## Tool Result Sizes (bytes)

- count: 7673
- sum: 17,123,125
- p50: 255
- p90: 2,352
- max: 656,856

## File Re-reads

- redundant_read_count: 405
- top paths:
  - 18× C:\work\mega\hero-crew-autonomous-loop\scripts\lib\slice-linker.mjs
  - 18× C:\work\mega\hero-crew-autonomous-loop\src\scripts\lib\slice-linker.mts
  - 11× C:\work\mega\Astra.Humanizer\docs\superpowers\plans\2026-05-28-portal-stealth-redesign.md
  - 10× C:\work\mega\hero-crew\scripts\crew.mjs
  - 10× C:\work\mega\hero-crew\scripts\lib\artifacts.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 3316 calls, 3,006,763B results, ~17,531,773 cache_create tok (5.83×)
- TaskCreate: 177 calls, 11,632B results, ~7,799,321 cache_create tok (670.51×)
- Read: 1176 calls, 4,512,686B results, ~5,425,228 cache_create tok (1.2×)
- ToolSearch: 54 calls, 7,375B results, ~3,331,798 cache_create tok (451.77×)
- Edit: 975 calls, 172,812B results, ~2,795,227 cache_create tok (16.17×)
- PowerShell: 348 calls, 206,656B results, ~1,993,695 cache_create tok (9.65×)
- Agent: 183 calls, 429,607B results, ~1,542,578 cache_create tok (3.59×)
- TaskUpdate: 326 calls, 7,241B results, ~1,270,662 cache_create tok (175.48×)
- Write: 249 calls, 46,040B results, ~1,184,168 cache_create tok (25.72×)
- AskUserQuestion: 85 calls, 23,179B results, ~956,280 cache_create tok (41.26×)
- Grep: 289 calls, 226,762B results, ~667,330 cache_create tok (2.94×)
- Glob: 155 calls, 75,943B results, ~256,364 cache_create tok (3.38×)
- Skill: 33 calls, 8,121B results, ~227,645 cache_create tok (28.03×)
- mcp__plugin_playwright_playwright__browser_snapshot: 43 calls, 91,193B results, ~111,088 cache_create tok (1.22×)
- mcp__plugin_playwright_playwright__browser_take_screenshot: 43 calls, 8,200,294B results, ~85,488 cache_create tok (0.01×)
- mcp__plugin_playwright_playwright__browser_navigate: 100 calls, 39,678B results, ~44,764 cache_create tok (1.13×)
- TaskStop: 25 calls, 9,803B results, ~19,400 cache_create tok (1.98×)
- mcp__plugin_playwright_playwright__browser_console_messages: 32 calls, 14,154B results, ~14,195 cache_create tok (1×)
- ExitPlanMode: 2 calls, 9,772B results, ~10,044 cache_create tok (1.03×)
- mcp__plugin_playwright_playwright__browser_close: 3 calls, 515B results, ~8,266 cache_create tok (16.05×)
- mcp__plugin_playwright_playwright__browser_click: 19 calls, 6,896B results, ~8,208 cache_create tok (1.19×)
- mcp__plugin_playwright_playwright__browser_evaluate: 9 calls, 4,463B results, ~6,795 cache_create tok (1.52×)
- mcp__plugin_playwright_playwright__browser_network_requests: 5 calls, 1,642B results, ~6,760 cache_create tok (4.12×)
- mcp__plugin_playwright_playwright__browser_fill_form: 10 calls, 2,419B results, ~2,972 cache_create tok (1.23×)
- mcp__plugin_playwright_playwright__browser_file_upload: 5 calls, 1,418B results, ~1,862 cache_create tok (1.31×)
- mcp__plugin_playwright_playwright__browser_wait_for: 4 calls, 1,237B results, ~1,172 cache_create tok (0.95×)
- TaskOutput: 1 calls, 137B results, ~644 cache_create tok (4.7×)
- mcp__plugin_playwright_playwright__browser_type: 2 calls, 112B results, ~394 cache_create tok (3.52×)
- SendMessage: 1 calls, 171B results, ~257 cache_create tok (1.5×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 9191
- usd: $5770.4385
- input: 34,902
- cache_create_5m: 0
- cache_create_1h: 37,878,282
- cache_read: 2,742,104,235
- output: 6,938,802

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 3588
- usd: $189.1497
- input: 19,942
- cache_create_5m: 0
- cache_create_1h: 7,478,270
- cache_read: 378,206,441
- output: 2,050,557

