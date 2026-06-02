---
kind: cost-report
run_title: "Brainstorming session — consumer bump + investigation design (mid-flight)"
usd: 3642.1256
duration_ms: 452970576
total_tokens: 2038349389
cache_hit_pct: 98.4
source_project: aggregate
aggregate_all: true
source_count: 9
created_at: 2026-06-02T21:20:59.991Z
---

# Cost Report: Brainstorming session — consumer bump + investigation design (mid-flight)

- Created: 2026-06-02T21:20:59.991Z
- Run Title: Brainstorming session — consumer bump + investigation design (mid-flight)
- Window Start: 2026-05-28T15:31:27.373Z
- Window End: 2026-06-02T21:20:57.949Z
- Duration: 7549.5 min (452970576 ms)
- Sessions Scanned: 17
- Assistant Messages Counted: 8811
- Total Tokens: 2,038,349,389
- Cache Hit %: 98.4%
- Total USD: $3642.1256
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega: 1264 msgs, $1096.9045
- C--work-mega-hero-crew: 1799 msgs, $859.5250
- C--work-mega-cortex: 726 msgs, $483.7899
- C--work-mega-Astra-Humanizer: 1030 msgs, $392.6611
- C--work-mega-AstraGenie-MemoryService: 1112 msgs, $376.1452
- C--work-mega-hero-crew-autonomous-loop: 1859 msgs, $311.6268
- C--work-mega-authentic: 998 msgs, $105.1410
- C--work-mega-tools: 16 msgs, $10.3363
- C--work-mega-loopobserver: 7 msgs, $5.9958

## Tokens (totals)

- input: 44,684
- cache_create_5m: 0
- cache_create_1h: 31,608,667
- cache_read: 2,000,713,042
- output: 5,982,996

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 5223 msgs (59.28%), $3452.9759 (94.81%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 3588 msgs (40.72%), $189.1497 (5.19%)

## Conversation Shape

- user_msg_count: 390
- user_msg_avg_len: 684
- turns_before_first_tool: 1
- compaction_count: 135
- skill_invocations: 16
- subagent_dispatches: 112

## Tool Usage

- Bash: 2341 (77 failed)
- Read: 850 (10 failed)
- Edit: 721 (34 failed)
- PowerShell: 288 (62 failed)
- Write: 187 (11 failed)
- TaskUpdate: 164
- Grep: 158 (1 failed)
- Agent: 112
- Glob: 100
- TaskCreate: 87
- AskUserQuestion: 57 (7 failed)
- mcp__plugin_playwright_playwright__browser_navigate: 50 (10 failed)
- ToolSearch: 31
- mcp__plugin_playwright_playwright__browser_take_screenshot: 26
- Skill: 16 (2 failed)
- mcp__plugin_playwright_playwright__browser_snapshot: 15 (1 failed)
- mcp__plugin_playwright_playwright__browser_console_messages: 10
- TaskStop: 5
- mcp__plugin_playwright_playwright__browser_fill_form: 1
- mcp__plugin_playwright_playwright__browser_click: 1
- SendMessage: 1 (1 failed)
- mcp__plugin_playwright_playwright__browser_network_requests: 1
- ExitPlanMode: 1

## Tool Result Sizes (bytes)

- count: 5295
- sum: 14,824,902
- p50: 265
- p90: 2,513
- max: 656,856

## File Re-reads

- redundant_read_count: 321
- top paths:
  - 18× C:\work\mega\hero-crew-autonomous-loop\scripts\lib\slice-linker.mjs
  - 18× C:\work\mega\hero-crew-autonomous-loop\src\scripts\lib\slice-linker.mts
  - 11× C:\work\mega\Astra.Humanizer\docs\superpowers\plans\2026-05-28-portal-stealth-redesign.md
  - 10× C:\work\mega\hero-crew\scripts\crew.mjs
  - 10× C:\work\mega\hero-crew\scripts\lib\artifacts.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 2369 calls, 2,293,219B results, ~11,681,369 cache_create tok (5.09×)
- TaskCreate: 87 calls, 5,906B results, ~5,026,307 cache_create tok (851.05×)
- Read: 888 calls, 3,438,647B results, ~4,049,151 cache_create tok (1.18×)
- ToolSearch: 31 calls, 3,390B results, ~2,776,897 cache_create tok (819.14×)
- Edit: 722 calls, 129,638B results, ~2,427,217 cache_create tok (18.72×)
- PowerShell: 289 calls, 188,405B results, ~1,751,419 cache_create tok (9.3×)
- Agent: 112 calls, 269,084B results, ~995,623 cache_create tok (3.7×)
- AskUserQuestion: 57 calls, 14,231B results, ~794,997 cache_create tok (55.86×)
- Write: 187 calls, 35,160B results, ~730,515 cache_create tok (20.78×)
- TaskUpdate: 164 calls, 3,681B results, ~486,908 cache_create tok (132.28×)
- Grep: 159 calls, 111,960B results, ~396,596 cache_create tok (3.54×)
- Glob: 100 calls, 40,140B results, ~157,548 cache_create tok (3.92×)
- Skill: 16 calls, 7,351B results, ~103,177 cache_create tok (14.04×)
- mcp__plugin_playwright_playwright__browser_take_screenshot: 26 calls, 8,194,511B results, ~73,944 cache_create tok (0.01×)
- mcp__plugin_playwright_playwright__browser_snapshot: 15 calls, 46,103B results, ~59,607 cache_create tok (1.29×)
- mcp__plugin_playwright_playwright__browser_navigate: 50 calls, 19,246B results, ~23,018 cache_create tok (1.2×)
- TaskStop: 5 calls, 3,157B results, ~7,605 cache_create tok (2.41×)
- ExitPlanMode: 1 calls, 5,957B results, ~5,730 cache_create tok (0.96×)
- mcp__plugin_playwright_playwright__browser_network_requests: 1 calls, 444B results, ~4,248 cache_create tok (9.57×)
- mcp__plugin_playwright_playwright__browser_console_messages: 10 calls, 9,254B results, ~3,797 cache_create tok (0.41×)
- mcp__plugin_playwright_playwright__browser_click: 1 calls, 584B results, ~300 cache_create tok (0.51×)
- mcp__plugin_playwright_playwright__browser_fill_form: 1 calls, 259B results, ~263 cache_create tok (1.02×)
- SendMessage: 1 calls, 171B results, ~257 cache_create tok (1.5×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 5223
- usd: $3452.9759
- input: 24,742
- cache_create_5m: 0
- cache_create_1h: 24,130,397
- cache_read: 1,622,506,601
- output: 3,932,439

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 3588
- usd: $189.1497
- input: 19,942
- cache_create_5m: 0
- cache_create_1h: 7,478,270
- cache_read: 378,206,441
- output: 2,050,557

