---
kind: cost-report
slice: SLICE-04
run_title: "SLICE-04"
usd: 226.8454
duration_ms: 1082994
total_tokens: 147445045
cache_hit_pct: 99.7
source_project: aggregate
aggregate_all: true
source_count: 3
created_at: 2026-05-24T00:08:23.058Z
---

# Cost Report: Cost — SLICE-04

- Created: 2026-05-24T00:08:23.058Z
- Run Title: SLICE-04
- Window Start: 2026-05-23T23:50:19.825Z
- Window End: 2026-05-24T00:08:22.819Z
- Duration: 18.0 min (1082994 ms)
- Sessions Scanned: 3
- Assistant Messages Counted: 448
- Total Tokens: 147,445,045
- Cache Hit %: 99.7%
- Total USD: $226.8454
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-AstraGenie-MemoryService: 163 msgs, $120.8792
- C--work-mega-hero-crew: 124 msgs, $99.8279
- C--work-mega-Astra-LoopObserver: 161 msgs, $6.1383

## Outcome Linkage

- Slice: SLICE-04
- Grade Avg: -
- Review Decision: -
- Validation Decision: -

## Tokens (totals)

- input: 4,065
- cache_create_5m: 0
- cache_create_1h: 502,952
- cache_read: 146,722,492
- output: 215,536

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 287 msgs (64.06%), $220.7071 (97.29%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 161 msgs (35.94%), $6.1383 (2.71%)

## Conversation Shape

- user_msg_count: 7
- user_msg_avg_len: 2291
- turns_before_first_tool: 1
- compaction_count: 1
- skill_invocations: 0
- subagent_dispatches: 1

## Tool Usage

- Bash: 80
- Read: 71
- Edit: 56 (1 failed)
- Grep: 15
- mcp__plugin_playwright_playwright__browser_navigate: 13
- Write: 13 (1 failed)
- Glob: 7
- mcp__plugin_playwright_playwright__browser_snapshot: 6
- mcp__plugin_playwright_playwright__browser_evaluate: 6 (1 failed)
- mcp__plugin_playwright_playwright__browser_take_screenshot: 4
- ToolSearch: 3
- mcp__plugin_playwright_playwright__browser_click: 2
- PowerShell: 2
- TaskUpdate: 2
- mcp__plugin_playwright_playwright__browser_file_upload: 2
- TaskCreate: 1
- mcp__plugin_playwright_playwright__browser_press_key: 1 (1 failed)
- mcp__plugin_playwright_playwright__browser_close: 1
- Agent: 1

## Tool Result Sizes (bytes)

- count: 287
- sum: 395,268
- p50: 341
- p90: 1,887
- max: 48,380

## File Re-reads

- redundant_read_count: 16
- top paths:
  - 6× C:\work\mega\AstraGenie.MemoryService\src\frontend\memory-dashboard\src\pages\ImportDataPage.tsx
  - 4× C:\work\mega\hero-crew-autonomous-loop\scripts\lib\slice-linker.mjs
  - 3× C:\work\mega\AstraGenie.MemoryService\src\frontend\memory-dashboard\src\pages\ImportMdPage.tsx
  - 3× C:\work\mega\hero-crew\scripts\validate-routing-table.mjs
  - 3× C:\work\mega\hero-crew-autonomous-loop\scripts\loop.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Read: 71 calls, 262,343B results, ~134,854 cache_create tok (0.51×)
- Bash: 80 calls, 78,895B results, ~119,344 cache_create tok (1.51×)
- Edit: 56 calls, 11,053B results, ~96,651 cache_create tok (8.74×)
- Write: 13 calls, 2,409B results, ~18,990 cache_create tok (7.88×)
- mcp__plugin_playwright_playwright__browser_snapshot: 6 calls, 13,415B results, ~10,466 cache_create tok (0.78×)
- Grep: 15 calls, 6,364B results, ~9,502 cache_create tok (1.49×)
- Agent: 1 calls, 391B results, ~7,842 cache_create tok (20.06×)
- mcp__plugin_playwright_playwright__browser_navigate: 13 calls, 8,323B results, ~6,816 cache_create tok (0.82×)
- Glob: 7 calls, 2,304B results, ~6,193 cache_create tok (2.69×)
- mcp__plugin_playwright_playwright__browser_evaluate: 6 calls, 3,295B results, ~4,920 cache_create tok (1.49×)
- TaskUpdate: 2 calls, 46B results, ~4,000 cache_create tok (86.96×)
- ToolSearch: 3 calls, 660B results, ~3,856 cache_create tok (5.84×)
- mcp__plugin_playwright_playwright__browser_click: 2 calls, 2,068B results, ~2,170 cache_create tok (1.05×)
- mcp__plugin_playwright_playwright__browser_file_upload: 2 calls, 1,227B results, ~1,836 cache_create tok (1.5×)
- TaskCreate: 1 calls, 74B results, ~842 cache_create tok (11.38×)
- mcp__plugin_playwright_playwright__browser_take_screenshot: 4 calls, 1,131B results, ~821 cache_create tok (0.73×)
- PowerShell: 2 calls, 20B results, ~581 cache_create tok (29.05×)
- mcp__plugin_playwright_playwright__browser_close: 1 calls, 615B results, ~356 cache_create tok (0.58×)
- mcp__plugin_playwright_playwright__browser_press_key: 1 calls, 370B results, ~304 cache_create tok (0.82×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 161
- usd: $6.1383
- input: 195
- cache_create_5m: 0
- cache_create_1h: 234,565
- cache_read: 12,896,605
- output: 57,421

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 287
- usd: $220.7071
- input: 3,870
- cache_create_5m: 0
- cache_create_1h: 268,387
- cache_read: 133,825,887
- output: 158,115

