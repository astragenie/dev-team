---
kind: cost-report
run_title: "Normalise Skills-you-consult heading to H3 + revert builder scope-violation on validate-skills.mjs"
usd: 5383.6882
duration_ms: 589830034
total_tokens: 2907206049
cache_hit_pct: 98.5
source_project: aggregate
aggregate_all: true
source_count: 9
created_at: 2026-06-04T11:21:59.514Z
---

# Cost Report: Normalise Skills-you-consult heading to H3 + revert builder scope-violation on validate-skills.mjs

- Created: 2026-06-04T11:21:59.514Z
- Run Title: Normalise Skills-you-consult heading to H3 + revert builder scope-violation on validate-skills.mjs
- Window Start: 2026-05-28T15:31:27.373Z
- Window End: 2026-06-04T11:21:57.407Z
- Duration: 9830.5 min (589830034 ms)
- Sessions Scanned: 23
- Assistant Messages Counted: 11731
- Total Tokens: 2,907,206,049
- Cache Hit %: 98.5%
- Total USD: $5383.6882
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega: 1395 msgs, $1133.5313
- C--work-mega-cortex: 1464 msgs, $1103.8590
- C--work-mega-hero-crew: 2218 msgs, $1091.3665
- C--work-mega-loopobserver: 1571 msgs, $834.5453
- C--work-mega-Astra-Humanizer: 1030 msgs, $392.6611
- C--work-mega-AstraGenie-MemoryService: 1112 msgs, $376.1452
- C--work-mega-hero-crew-autonomous-loop: 1859 msgs, $311.6268
- C--work-mega-authentic: 1066 msgs, $129.6169
- C--work-mega-tools: 16 msgs, $10.3363

## Tokens (totals)

- input: 52,465
- cache_create_5m: 0
- cache_create_1h: 42,004,531
- cache_read: 2,857,235,575
- output: 7,913,478

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 8143 msgs (69.41%), $5194.5385 (96.49%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 3588 msgs (30.59%), $189.1497 (3.51%)

## Conversation Shape

- user_msg_count: 562
- user_msg_avg_len: 533
- turns_before_first_tool: 1
- compaction_count: 211
- skill_invocations: 29
- subagent_dispatches: 136

## Tool Usage

- Bash: 3053 (91 failed)
- Read: 1064 (11 failed)
- Edit: 879 (43 failed)
- PowerShell: 340 (69 failed)
- Grep: 272 (3 failed)
- TaskUpdate: 252
- Write: 226 (11 failed)
- Glob: 150
- TaskCreate: 147
- Agent: 136
- mcp__plugin_playwright_playwright__browser_navigate: 91 (12 failed)
- AskUserQuestion: 78 (14 failed)
- ToolSearch: 51
- mcp__plugin_playwright_playwright__browser_snapshot: 42 (3 failed)
- mcp__plugin_playwright_playwright__browser_take_screenshot: 35
- mcp__plugin_playwright_playwright__browser_console_messages: 32
- Skill: 29 (2 failed)
- TaskStop: 25
- mcp__plugin_playwright_playwright__browser_click: 19 (1 failed)
- mcp__plugin_playwright_playwright__browser_fill_form: 10 (1 failed)
- mcp__plugin_playwright_playwright__browser_evaluate: 7 (1 failed)
- mcp__plugin_playwright_playwright__browser_network_requests: 5
- mcp__plugin_playwright_playwright__browser_file_upload: 5 (2 failed)
- mcp__plugin_playwright_playwright__browser_type: 2 (2 failed)
- ExitPlanMode: 2
- mcp__plugin_playwright_playwright__browser_close: 2
- SendMessage: 1 (1 failed)
- TaskOutput: 1

## Tool Result Sizes (bytes)

- count: 7027
- sum: 16,385,404
- p50: 262
- p90: 2,383
- max: 656,856

## File Re-reads

- redundant_read_count: 391
- top paths:
  - 18× C:\work\mega\hero-crew-autonomous-loop\scripts\lib\slice-linker.mjs
  - 18× C:\work\mega\hero-crew-autonomous-loop\src\scripts\lib\slice-linker.mts
  - 11× C:\work\mega\Astra.Humanizer\docs\superpowers\plans\2026-05-28-portal-stealth-redesign.md
  - 10× C:\work\mega\hero-crew\scripts\crew.mjs
  - 10× C:\work\mega\hero-crew\scripts\lib\artifacts.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 3082 calls, 2,853,080B results, ~16,908,667 cache_create tok (5.93×)
- TaskCreate: 147 calls, 9,919B results, ~6,721,160 cache_create tok (677.6×)
- Read: 1102 calls, 4,113,708B results, ~5,036,769 cache_create tok (1.22×)
- ToolSearch: 51 calls, 6,484B results, ~3,227,237 cache_create tok (497.72×)
- Edit: 880 calls, 158,351B results, ~2,679,129 cache_create tok (16.92×)
- PowerShell: 341 calls, 206,332B results, ~1,985,691 cache_create tok (9.62×)
- Agent: 134 calls, 304,516B results, ~1,295,954 cache_create tok (4.26×)
- Write: 226 calls, 42,179B results, ~1,031,255 cache_create tok (24.45×)
- AskUserQuestion: 78 calls, 21,701B results, ~924,976 cache_create tok (42.62×)
- TaskUpdate: 252 calls, 5,615B results, ~774,127 cache_create tok (137.87×)
- Grep: 273 calls, 207,795B results, ~628,736 cache_create tok (3.03×)
- Glob: 150 calls, 71,029B results, ~245,312 cache_create tok (3.45×)
- Skill: 29 calls, 7,922B results, ~194,418 cache_create tok (24.54×)
- mcp__plugin_playwright_playwright__browser_snapshot: 42 calls, 88,414B results, ~108,530 cache_create tok (1.23×)
- mcp__plugin_playwright_playwright__browser_take_screenshot: 35 calls, 8,197,769B results, ~79,890 cache_create tok (0.01×)
- mcp__plugin_playwright_playwright__browser_navigate: 91 calls, 36,149B results, ~40,845 cache_create tok (1.13×)
- TaskStop: 25 calls, 9,803B results, ~19,400 cache_create tok (1.98×)
- mcp__plugin_playwright_playwright__browser_console_messages: 32 calls, 14,154B results, ~14,195 cache_create tok (1×)
- ExitPlanMode: 2 calls, 9,772B results, ~10,044 cache_create tok (1.03×)
- mcp__plugin_playwright_playwright__browser_click: 19 calls, 6,896B results, ~8,208 cache_create tok (1.19×)
- mcp__plugin_playwright_playwright__browser_network_requests: 5 calls, 1,642B results, ~6,760 cache_create tok (4.12×)
- mcp__plugin_playwright_playwright__browser_evaluate: 7 calls, 3,229B results, ~4,697 cache_create tok (1.45×)
- mcp__plugin_playwright_playwright__browser_fill_form: 10 calls, 2,419B results, ~2,972 cache_create tok (1.23×)
- mcp__plugin_playwright_playwright__browser_file_upload: 5 calls, 1,418B results, ~1,862 cache_create tok (1.31×)
- TaskOutput: 1 calls, 137B results, ~644 cache_create tok (4.7×)
- mcp__plugin_playwright_playwright__browser_type: 2 calls, 112B results, ~394 cache_create tok (3.52×)
- SendMessage: 1 calls, 171B results, ~257 cache_create tok (1.5×)
- mcp__plugin_playwright_playwright__browser_close: 2 calls, 284B results, ~228 cache_create tok (0.8×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 8143
- usd: $5194.5385
- input: 32,523
- cache_create_5m: 0
- cache_create_1h: 34,526,261
- cache_read: 2,479,029,134
- output: 5,862,921

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 3588
- usd: $189.1497
- input: 19,942
- cache_create_5m: 0
- cache_create_1h: 7,478,270
- cache_read: 378,206,441
- output: 2,050,557

