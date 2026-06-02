---
kind: cost-report
run_title: "Brainstorming + writing-plans complete — spec + plan committed, awaiting execution choice"
usd: 3782.7602
duration_ms: 454015776
total_tokens: 2108450023
cache_hit_pct: 98.5
source_project: aggregate
aggregate_all: true
source_count: 9
created_at: 2026-06-02T21:38:25.100Z
---

# Cost Report: Brainstorming + writing-plans complete — spec + plan committed, awaiting execution choice

- Created: 2026-06-02T21:38:25.100Z
- Run Title: Brainstorming + writing-plans complete — spec + plan committed, awaiting execution choice
- Window Start: 2026-05-28T15:31:27.373Z
- Window End: 2026-06-02T21:38:23.149Z
- Duration: 7566.9 min (454015776 ms)
- Sessions Scanned: 17
- Assistant Messages Counted: 8996
- Total Tokens: 2,108,450,023
- Cache Hit %: 98.5%
- Total USD: $3782.7602
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega: 1264 msgs, $1096.9045
- C--work-mega-hero-crew: 1826 msgs, $889.9711
- C--work-mega-cortex: 808 msgs, $558.7243
- C--work-mega-Astra-Humanizer: 1030 msgs, $392.6611
- C--work-mega-AstraGenie-MemoryService: 1112 msgs, $376.1452
- C--work-mega-hero-crew-autonomous-loop: 1859 msgs, $311.6268
- C--work-mega-authentic: 1019 msgs, $110.1336
- C--work-mega-loopobserver: 62 msgs, $36.2575
- C--work-mega-tools: 16 msgs, $10.3363

## Tokens (totals)

- input: 45,081
- cache_create_5m: 0
- cache_create_1h: 32,457,103
- cache_read: 2,069,811,130
- output: 6,136,709

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 5408 msgs (60.12%), $3593.6105 (95%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 3588 msgs (39.88%), $189.1497 (5%)

## Conversation Shape

- user_msg_count: 401
- user_msg_avg_len: 667
- turns_before_first_tool: 1
- compaction_count: 139
- skill_invocations: 17
- subagent_dispatches: 112

## Tool Usage

- Bash: 2375 (77 failed)
- Read: 855 (10 failed)
- Edit: 731 (34 failed)
- PowerShell: 290 (62 failed)
- Write: 189 (11 failed)
- TaskUpdate: 170
- Grep: 162 (1 failed)
- Agent: 112
- Glob: 107
- TaskCreate: 91
- AskUserQuestion: 60 (8 failed)
- mcp__plugin_playwright_playwright__browser_navigate: 55 (11 failed)
- ToolSearch: 33
- mcp__plugin_playwright_playwright__browser_take_screenshot: 26
- mcp__plugin_playwright_playwright__browser_snapshot: 19 (3 failed)
- Skill: 17 (2 failed)
- mcp__plugin_playwright_playwright__browser_console_messages: 10
- TaskStop: 5
- mcp__plugin_playwright_playwright__browser_file_upload: 5 (2 failed)
- mcp__plugin_playwright_playwright__browser_click: 3 (1 failed)
- mcp__plugin_playwright_playwright__browser_fill_form: 1
- SendMessage: 1 (1 failed)
- mcp__plugin_playwright_playwright__browser_network_requests: 1
- ExitPlanMode: 1

## Tool Result Sizes (bytes)

- count: 5392
- sum: 14,905,558
- p50: 264
- p90: 2,513
- max: 656,856

## File Re-reads

- redundant_read_count: 323
- top paths:
  - 18× C:\work\mega\hero-crew-autonomous-loop\scripts\lib\slice-linker.mjs
  - 18× C:\work\mega\hero-crew-autonomous-loop\src\scripts\lib\slice-linker.mts
  - 11× C:\work\mega\Astra.Humanizer\docs\superpowers\plans\2026-05-28-portal-stealth-redesign.md
  - 10× C:\work\mega\hero-crew\scripts\crew.mjs
  - 10× C:\work\mega\hero-crew\scripts\lib\artifacts.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 2404 calls, 2,327,811B results, ~11,777,264 cache_create tok (5.06×)
- TaskCreate: 91 calls, 6,197B results, ~5,311,153 cache_create tok (857.05×)
- Read: 893 calls, 3,451,875B results, ~4,282,157 cache_create tok (1.24×)
- ToolSearch: 33 calls, 3,771B results, ~2,778,847 cache_create tok (736.9×)
- Edit: 732 calls, 131,492B results, ~2,446,973 cache_create tok (18.61×)
- PowerShell: 291 calls, 188,437B results, ~1,758,760 cache_create tok (9.33×)
- Agent: 112 calls, 269,084B results, ~995,623 cache_create tok (3.7×)
- AskUserQuestion: 60 calls, 15,336B results, ~800,003 cache_create tok (52.17×)
- Write: 189 calls, 35,541B results, ~780,795 cache_create tok (21.97×)
- TaskUpdate: 170 calls, 3,826B results, ~567,199 cache_create tok (148.25×)
- Grep: 163 calls, 121,003B results, ~418,874 cache_create tok (3.46×)
- Glob: 107 calls, 45,022B results, ~180,492 cache_create tok (4.01×)
- Skill: 17 calls, 7,393B results, ~110,032 cache_create tok (14.88×)
- mcp__plugin_playwright_playwright__browser_take_screenshot: 26 calls, 8,194,511B results, ~73,944 cache_create tok (0.01×)
- mcp__plugin_playwright_playwright__browser_snapshot: 19 calls, 57,086B results, ~72,033 cache_create tok (1.26×)
- mcp__plugin_playwright_playwright__browser_navigate: 55 calls, 21,102B results, ~25,574 cache_create tok (1.21×)
- TaskStop: 5 calls, 3,157B results, ~7,605 cache_create tok (2.41×)
- ExitPlanMode: 1 calls, 5,957B results, ~5,730 cache_create tok (0.96×)
- mcp__plugin_playwright_playwright__browser_network_requests: 1 calls, 444B results, ~4,248 cache_create tok (9.57×)
- mcp__plugin_playwright_playwright__browser_console_messages: 10 calls, 9,254B results, ~3,797 cache_create tok (0.41×)
- mcp__plugin_playwright_playwright__browser_file_upload: 5 calls, 1,418B results, ~1,862 cache_create tok (1.31×)
- mcp__plugin_playwright_playwright__browser_click: 3 calls, 1,007B results, ~1,444 cache_create tok (1.43×)
- mcp__plugin_playwright_playwright__browser_fill_form: 1 calls, 259B results, ~263 cache_create tok (1.02×)
- SendMessage: 1 calls, 171B results, ~257 cache_create tok (1.5×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 5408
- usd: $3593.6105
- input: 25,139
- cache_create_5m: 0
- cache_create_1h: 24,978,833
- cache_read: 1,691,604,689
- output: 4,086,152

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 3588
- usd: $189.1497
- input: 19,942
- cache_create_5m: 0
- cache_create_1h: 7,478,270
- cache_read: 378,206,441
- output: 2,050,557

