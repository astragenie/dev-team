---
kind: cost-report
run_title: "Consumer bump runbook + cost-hotspot investigation shipped"
usd: 3908.3001
duration_ms: 454868235
total_tokens: 2167920252
cache_hit_pct: 98.5
source_project: aggregate
aggregate_all: true
source_count: 9
created_at: 2026-06-02T21:52:37.706Z
---

# Cost Report: Consumer bump runbook + cost-hotspot investigation shipped

- Created: 2026-06-02T21:52:37.706Z
- Run Title: Consumer bump runbook + cost-hotspot investigation shipped
- Window Start: 2026-05-28T15:31:27.373Z
- Window End: 2026-06-02T21:52:35.608Z
- Duration: 7581.1 min (454868235 ms)
- Sessions Scanned: 17
- Assistant Messages Counted: 9145
- Total Tokens: 2,167,920,252
- Cache Hit %: 98.5%
- Total USD: $3908.3001
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega: 1264 msgs, $1096.9045
- C--work-mega-hero-crew: 1847 msgs, $914.1826
- C--work-mega-cortex: 869 msgs, $636.4288
- C--work-mega-Astra-Humanizer: 1030 msgs, $392.6611
- C--work-mega-AstraGenie-MemoryService: 1112 msgs, $376.1452
- C--work-mega-hero-crew-autonomous-loop: 1859 msgs, $311.6268
- C--work-mega-authentic: 1019 msgs, $110.1336
- C--work-mega-loopobserver: 129 msgs, $59.8813
- C--work-mega-tools: 16 msgs, $10.3363

## Tokens (totals)

- input: 45,342
- cache_create_5m: 0
- cache_create_1h: 33,365,529
- cache_read: 2,128,230,620
- output: 6,278,761

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 5557 msgs (60.77%), $3719.1503 (95.16%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 3588 msgs (39.23%), $189.1497 (4.84%)

## Conversation Shape

- user_msg_count: 406
- user_msg_avg_len: 660
- turns_before_first_tool: 1
- compaction_count: 142
- skill_invocations: 18
- subagent_dispatches: 115

## Tool Usage

- Bash: 2405 (77 failed)
- Read: 869 (10 failed)
- Edit: 741 (34 failed)
- PowerShell: 293 (62 failed)
- Write: 190 (11 failed)
- TaskUpdate: 175
- Grep: 163 (1 failed)
- Agent: 115
- Glob: 108
- TaskCreate: 94
- AskUserQuestion: 62 (9 failed)
- mcp__plugin_playwright_playwright__browser_navigate: 57 (11 failed)
- ToolSearch: 34
- mcp__plugin_playwright_playwright__browser_take_screenshot: 26
- mcp__plugin_playwright_playwright__browser_snapshot: 20 (3 failed)
- Skill: 18 (2 failed)
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

- count: 5474
- sum: 15,007,838
- p50: 265
- p90: 2,522
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

- Bash: 2434 calls, 2,387,408B results, ~12,495,665 cache_create tok (5.23×)
- TaskCreate: 94 calls, 6,418B results, ~5,313,565 cache_create tok (827.92×)
- Read: 907 calls, 3,483,294B results, ~4,330,260 cache_create tok (1.24×)
- ToolSearch: 34 calls, 3,959B results, ~2,779,793 cache_create tok (702.15×)
- Edit: 742 calls, 133,449B results, ~2,482,044 cache_create tok (18.6×)
- PowerShell: 294 calls, 188,824B results, ~1,775,568 cache_create tok (9.4×)
- Agent: 114 calls, 271,926B results, ~1,092,797 cache_create tok (4.02×)
- AskUserQuestion: 62 calls, 16,272B results, ~807,263 cache_create tok (49.61×)
- Write: 190 calls, 35,736B results, ~786,725 cache_create tok (22.01×)
- TaskUpdate: 175 calls, 3,936B results, ~512,069 cache_create tok (130.1×)
- Grep: 164 calls, 121,090B results, ~425,582 cache_create tok (3.51×)
- Glob: 108 calls, 45,046B results, ~182,073 cache_create tok (4.04×)
- Skill: 18 calls, 7,449B results, ~124,846 cache_create tok (16.76×)
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
- messages: 5557
- usd: $3719.1503
- input: 25,400
- cache_create_5m: 0
- cache_create_1h: 25,887,259
- cache_read: 1,750,024,179
- output: 4,228,204

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 3588
- usd: $189.1497
- input: 19,942
- cache_create_5m: 0
- cache_create_1h: 7,478,270
- cache_read: 378,206,441
- output: 2,050,557

