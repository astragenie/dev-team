---
kind: cost-report
run_title: "Bump runbook mid-flight — syntax fix pushed, awaiting user marketplace-add keystroke"
usd: 3964.3655
duration_ms: 455655622
total_tokens: 2202373020
cache_hit_pct: 98.5
source_project: aggregate
aggregate_all: true
source_count: 9
created_at: 2026-06-02T22:05:44.908Z
---

# Cost Report: Bump runbook mid-flight — syntax fix pushed, awaiting user marketplace-add keystroke

- Created: 2026-06-02T22:05:44.908Z
- Run Title: Bump runbook mid-flight — syntax fix pushed, awaiting user marketplace-add keystroke
- Window Start: 2026-05-28T15:31:27.373Z
- Window End: 2026-06-02T22:05:42.995Z
- Duration: 7594.3 min (455655622 ms)
- Sessions Scanned: 17
- Assistant Messages Counted: 9206
- Total Tokens: 2,202,373,020
- Cache Hit %: 98.5%
- Total USD: $3964.3655
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega: 1264 msgs, $1096.9045
- C--work-mega-hero-crew: 1878 msgs, $946.4327
- C--work-mega-cortex: 890 msgs, $657.5803
- C--work-mega-Astra-Humanizer: 1030 msgs, $392.6611
- C--work-mega-AstraGenie-MemoryService: 1112 msgs, $376.1452
- C--work-mega-hero-crew-autonomous-loop: 1859 msgs, $311.6268
- C--work-mega-authentic: 1019 msgs, $110.1336
- C--work-mega-loopobserver: 138 msgs, $62.5450
- C--work-mega-tools: 16 msgs, $10.3363

## Tokens (totals)

- input: 45,515
- cache_create_5m: 0
- cache_create_1h: 33,431,852
- cache_read: 2,162,582,964
- output: 6,312,689

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 5618 msgs (61.03%), $3775.2157 (95.23%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 3588 msgs (38.97%), $189.1497 (4.77%)

## Conversation Shape

- user_msg_count: 414
- user_msg_avg_len: 653
- turns_before_first_tool: 1
- compaction_count: 145
- skill_invocations: 19
- subagent_dispatches: 115

## Tool Usage

- Bash: 2420 (77 failed)
- Read: 870 (10 failed)
- Edit: 743 (35 failed)
- PowerShell: 297 (63 failed)
- Write: 191 (11 failed)
- TaskUpdate: 175
- Grep: 165 (1 failed)
- Agent: 115
- Glob: 108
- TaskCreate: 94
- AskUserQuestion: 63 (9 failed)
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

- count: 5501
- sum: 15,021,229
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

- Bash: 2449 calls, 2,396,244B results, ~12,517,863 cache_create tok (5.22×)
- TaskCreate: 94 calls, 6,418B results, ~5,313,565 cache_create tok (827.92×)
- Read: 908 calls, 3,484,377B results, ~4,330,862 cache_create tok (1.24×)
- ToolSearch: 34 calls, 3,959B results, ~2,779,793 cache_create tok (702.15×)
- Edit: 744 calls, 133,722B results, ~2,483,920 cache_create tok (18.58×)
- PowerShell: 297 calls, 189,315B results, ~1,780,634 cache_create tok (9.41×)
- Agent: 115 calls, 272,651B results, ~1,038,733 cache_create tok (3.81×)
- Write: 191 calls, 35,960B results, ~860,067 cache_create tok (23.92×)
- AskUserQuestion: 63 calls, 16,401B results, ~813,582 cache_create tok (49.61×)
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
- messages: 5618
- usd: $3775.2157
- input: 25,573
- cache_create_5m: 0
- cache_create_1h: 25,953,582
- cache_read: 1,784,376,523
- output: 4,262,132

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 3588
- usd: $189.1497
- input: 19,942
- cache_create_5m: 0
- cache_create_1h: 7,478,270
- cache_read: 378,206,441
- output: 2,050,557

