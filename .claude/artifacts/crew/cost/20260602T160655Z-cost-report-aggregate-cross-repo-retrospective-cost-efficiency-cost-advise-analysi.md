---
kind: cost-report
run_title: "Cross-repo retrospective + cost-efficiency + cost-advise analysis arc"
usd: 3273.9069
duration_ms: 434126347
total_tokens: 1861341255
cache_hit_pct: 98.5
source_project: aggregate
aggregate_all: true
source_count: 8
created_at: 2026-06-02T16:06:55.660Z
---

# Cost Report: Cross-repo retrospective + cost-efficiency + cost-advise analysis arc

- Created: 2026-06-02T16:06:55.660Z
- Run Title: Cross-repo retrospective + cost-efficiency + cost-advise analysis arc
- Window Start: 2026-05-28T15:31:27.373Z
- Window End: 2026-06-02T16:06:53.720Z
- Duration: 7235.4 min (434126347 ms)
- Sessions Scanned: 15
- Assistant Messages Counted: 8247
- Total Tokens: 1,861,341,255
- Cache Hit %: 98.5%
- Total USD: $3273.9069
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega: 1264 msgs, $1096.9045
- C--work-mega-hero-crew: 1766 msgs, $796.9916
- C--work-mega-Astra-Humanizer: 1030 msgs, $392.6611
- C--work-mega-AstraGenie-MemoryService: 1112 msgs, $376.1452
- C--work-mega-hero-crew-autonomous-loop: 1859 msgs, $311.6268
- C--work-mega-cortex: 428 msgs, $206.0138
- C--work-mega-authentic: 772 msgs, $83.2277
- C--work-mega-tools: 16 msgs, $10.3363

## Tokens (totals)

- input: 40,148
- cache_create_5m: 0
- cache_create_1h: 27,567,260
- cache_read: 1,828,028,030
- output: 5,705,817

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 4858 msgs (58.91%), $3092.9841 (94.47%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 3389 msgs (41.09%), $180.9228 (5.53%)

## Conversation Shape

- user_msg_count: 375
- user_msg_avg_len: 705
- turns_before_first_tool: 1
- compaction_count: 129
- skill_invocations: 16
- subagent_dispatches: 112

## Tool Usage

- Bash: 2209 (72 failed)
- Read: 819 (10 failed)
- Edit: 703 (31 failed)
- PowerShell: 239 (56 failed)
- Write: 186 (11 failed)
- TaskUpdate: 164
- Grep: 152 (1 failed)
- Agent: 112
- Glob: 96
- TaskCreate: 87
- AskUserQuestion: 53 (7 failed)
- ToolSearch: 27
- mcp__plugin_playwright_playwright__browser_navigate: 23 (2 failed)
- mcp__plugin_playwright_playwright__browser_take_screenshot: 18
- Skill: 16 (2 failed)
- TaskStop: 5
- mcp__plugin_playwright_playwright__browser_snapshot: 2
- mcp__plugin_playwright_playwright__browser_console_messages: 1
- mcp__plugin_playwright_playwright__browser_fill_form: 1
- mcp__plugin_playwright_playwright__browser_click: 1
- SendMessage: 1 (1 failed)
- ExitPlanMode: 1

## Tool Result Sizes (bytes)

- count: 4988
- sum: 13,973,841
- p50: 261
- p90: 2,516
- max: 656,856

## File Re-reads

- redundant_read_count: 315
- top paths:
  - 18× C:\work\mega\hero-crew-autonomous-loop\scripts\lib\slice-linker.mjs
  - 18× C:\work\mega\hero-crew-autonomous-loop\src\scripts\lib\slice-linker.mts
  - 11× C:\work\mega\Astra.Humanizer\docs\superpowers\plans\2026-05-28-portal-stealth-redesign.md
  - 10× C:\work\mega\hero-crew\scripts\crew.mjs
  - 10× C:\work\mega\hero-crew\scripts\lib\artifacts.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 2238 calls, 2,151,298B results, ~9,226,816 cache_create tok (4.29×)
- TaskCreate: 87 calls, 5,906B results, ~5,026,307 cache_create tok (851.05×)
- Read: 857 calls, 2,806,869B results, ~3,668,104 cache_create tok (1.31×)
- Edit: 704 calls, 126,580B results, ~2,394,316 cache_create tok (18.92×)
- ToolSearch: 27 calls, 2,483B results, ~1,759,132 cache_create tok (708.47×)
- PowerShell: 239 calls, 168,029B results, ~1,684,944 cache_create tok (10.03×)
- Agent: 112 calls, 269,084B results, ~995,623 cache_create tok (3.7×)
- AskUserQuestion: 53 calls, 13,592B results, ~780,096 cache_create tok (57.39×)
- Write: 186 calls, 34,918B results, ~727,902 cache_create tok (20.85×)
- TaskUpdate: 164 calls, 3,681B results, ~486,908 cache_create tok (132.28×)
- Grep: 153 calls, 110,912B results, ~392,346 cache_create tok (3.54×)
- Glob: 96 calls, 39,004B results, ~155,702 cache_create tok (3.99×)
- Skill: 16 calls, 7,351B results, ~103,177 cache_create tok (14.04×)
- mcp__plugin_playwright_playwright__browser_take_screenshot: 18 calls, 8,191,517B results, ~72,241 cache_create tok (0.01×)
- mcp__plugin_playwright_playwright__browser_snapshot: 2 calls, 16,890B results, ~14,008 cache_create tok (0.83×)
- mcp__plugin_playwright_playwright__browser_navigate: 23 calls, 10,879B results, ~12,727 cache_create tok (1.17×)
- TaskStop: 5 calls, 3,157B results, ~7,605 cache_create tok (2.41×)
- ExitPlanMode: 1 calls, 5,957B results, ~5,730 cache_create tok (0.96×)
- mcp__plugin_playwright_playwright__browser_console_messages: 1 calls, 316B results, ~582 cache_create tok (1.84×)
- mcp__plugin_playwright_playwright__browser_click: 1 calls, 584B results, ~300 cache_create tok (0.51×)
- mcp__plugin_playwright_playwright__browser_fill_form: 1 calls, 259B results, ~263 cache_create tok (1.02×)
- SendMessage: 1 calls, 171B results, ~257 cache_create tok (1.5×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 4858
- usd: $3092.9841
- input: 21,333
- cache_create_5m: 0
- cache_create_1h: 20,515,847
- cache_read: 1,465,825,278
- output: 3,712,677

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 3389
- usd: $180.9228
- input: 18,815
- cache_create_5m: 0
- cache_create_1h: 7,051,413
- cache_read: 362,202,752
- output: 1,993,140

