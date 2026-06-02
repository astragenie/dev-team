---
kind: cost-report
run_title: "Bump progress: crew@0.7.0 active (hooks 10→15), loop bump in-flight"
usd: 3995.8109
duration_ms: 455885899
total_tokens: 2221222866
cache_hit_pct: 98.5
source_project: aggregate
aggregate_all: true
source_count: 9
created_at: 2026-06-02T22:09:35.198Z
---

# Cost Report: Bump progress: crew@0.7.0 active (hooks 10→15), loop bump in-flight

- Created: 2026-06-02T22:09:35.198Z
- Run Title: Bump progress: crew@0.7.0 active (hooks 10→15), loop bump in-flight
- Window Start: 2026-05-28T15:31:27.373Z
- Window End: 2026-06-02T22:09:33.272Z
- Duration: 7598.1 min (455885899 ms)
- Sessions Scanned: 17
- Assistant Messages Counted: 9235
- Total Tokens: 2,221,222,866
- Cache Hit %: 98.5%
- Total USD: $3995.8109
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega: 1264 msgs, $1096.9045
- C--work-mega-hero-crew: 1889 msgs, $959.7097
- C--work-mega-cortex: 908 msgs, $675.7487
- C--work-mega-Astra-Humanizer: 1030 msgs, $392.6611
- C--work-mega-AstraGenie-MemoryService: 1112 msgs, $376.1452
- C--work-mega-hero-crew-autonomous-loop: 1859 msgs, $311.6268
- C--work-mega-authentic: 1019 msgs, $110.1336
- C--work-mega-loopobserver: 138 msgs, $62.5450
- C--work-mega-tools: 16 msgs, $10.3363

## Tokens (totals)

- input: 45,569
- cache_create_5m: 0
- cache_create_1h: 33,506,201
- cache_read: 2,181,344,108
- output: 6,326,988

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 5647 msgs (61.15%), $3806.6612 (95.27%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 3588 msgs (38.85%), $189.1497 (4.73%)

## Conversation Shape

- user_msg_count: 424
- user_msg_avg_len: 640
- turns_before_first_tool: 1
- compaction_count: 152
- skill_invocations: 19
- subagent_dispatches: 115

## Tool Usage

- Bash: 2431 (77 failed)
- Read: 870 (10 failed)
- Edit: 743 (35 failed)
- PowerShell: 298 (64 failed)
- Write: 192 (11 failed)
- TaskUpdate: 175
- Grep: 165 (1 failed)
- Agent: 115
- Glob: 108
- TaskCreate: 94
- AskUserQuestion: 64 (9 failed)
- mcp__plugin_playwright_playwright__browser_navigate: 57 (11 failed)
- ToolSearch: 34
- mcp__plugin_playwright_playwright__browser_take_screenshot: 26
- mcp__plugin_playwright_playwright__browser_snapshot: 20 (3 failed)
- Skill: 19 (2 failed)
- mcp__plugin_playwright_playwright__browser_console_messages: 11
- TaskStop: 5
- mcp__plugin_playwright_playwright__browser_file_upload: 5 (2 failed)
- mcp__plugin_playwright_playwright__browser_click: 3 (1 failed)
- mcp__plugin_playwright_playwright__browser_network_requests: 3
- mcp__plugin_playwright_playwright__browser_type: 2 (2 failed)
- mcp__plugin_playwright_playwright__browser_fill_form: 1
- SendMessage: 1 (1 failed)
- ExitPlanMode: 1

## Tool Result Sizes (bytes)

- count: 5515
- sum: 15,032,585
- p50: 265
- p90: 2,516
- max: 656,856

## File Re-reads

- redundant_read_count: 325
- top paths:
  - 18× C:\work\mega\hero-crew-autonomous-loop\scripts\lib\slice-linker.mjs
  - 18× C:\work\mega\hero-crew-autonomous-loop\src\scripts\lib\slice-linker.mts
  - 11× C:\work\mega\Astra.Humanizer\docs\superpowers\plans\2026-05-28-portal-stealth-redesign.md
  - 10× C:\work\mega\hero-crew\scripts\crew.mjs
  - 10× C:\work\mega\hero-crew\scripts\lib\artifacts.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 2460 calls, 2,407,098B results, ~12,573,629 cache_create tok (5.22×)
- TaskCreate: 94 calls, 6,418B results, ~5,313,565 cache_create tok (827.92×)
- Read: 908 calls, 3,484,377B results, ~4,330,862 cache_create tok (1.24×)
- ToolSearch: 34 calls, 3,959B results, ~2,779,793 cache_create tok (702.15×)
- Edit: 744 calls, 133,722B results, ~2,483,920 cache_create tok (18.58×)
- PowerShell: 298 calls, 189,349B results, ~1,782,136 cache_create tok (9.41×)
- Agent: 115 calls, 272,651B results, ~1,038,733 cache_create tok (3.81×)
- Write: 192 calls, 36,199B results, ~873,110 cache_create tok (24.12×)
- AskUserQuestion: 64 calls, 16,630B results, ~817,620 cache_create tok (49.17×)
- TaskUpdate: 175 calls, 3,936B results, ~512,069 cache_create tok (130.1×)
- Grep: 166 calls, 122,661B results, ~427,263 cache_create tok (3.48×)
- Glob: 108 calls, 45,046B results, ~182,073 cache_create tok (4.04×)
- Skill: 19 calls, 7,508B results, ~134,149 cache_create tok (17.87×)
- mcp__plugin_playwright_playwright__browser_snapshot: 20 calls, 59,506B results, ~77,064 cache_create tok (1.3×)
- mcp__plugin_playwright_playwright__browser_take_screenshot: 26 calls, 8,194,511B results, ~73,944 cache_create tok (0.01×)
- mcp__plugin_playwright_playwright__browser_navigate: 57 calls, 21,946B results, ~27,035 cache_create tok (1.23×)
- TaskStop: 5 calls, 3,157B results, ~7,605 cache_create tok (2.41×)
- ExitPlanMode: 1 calls, 5,957B results, ~5,730 cache_create tok (0.96×)
- mcp__plugin_playwright_playwright__browser_network_requests: 3 calls, 1,064B results, ~5,128 cache_create tok (4.82×)
- mcp__plugin_playwright_playwright__browser_console_messages: 11 calls, 9,519B results, ~4,379 cache_create tok (0.46×)
- mcp__plugin_playwright_playwright__browser_file_upload: 5 calls, 1,418B results, ~1,862 cache_create tok (1.31×)
- mcp__plugin_playwright_playwright__browser_click: 3 calls, 1,007B results, ~1,444 cache_create tok (1.43×)
- mcp__plugin_playwright_playwright__browser_type: 2 calls, 112B results, ~394 cache_create tok (3.52×)
- mcp__plugin_playwright_playwright__browser_fill_form: 1 calls, 259B results, ~263 cache_create tok (1.02×)
- SendMessage: 1 calls, 171B results, ~257 cache_create tok (1.5×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 5647
- usd: $3806.6612
- input: 25,627
- cache_create_5m: 0
- cache_create_1h: 26,027,931
- cache_read: 1,803,137,667
- output: 4,276,431

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 3588
- usd: $189.1497
- input: 19,942
- cache_create_5m: 0
- cache_create_1h: 7,478,270
- cache_read: 378,206,441
- output: 2,050,557

