---
kind: cost-report
slice: SLICE-03
run_title: "SLICE-03"
usd: 123.2398
duration_ms: 633997
total_tokens: 79389788
cache_hit_pct: 99.6
review_decision: pass
source_project: aggregate
aggregate_all: true
source_count: 3
created_at: 2026-05-24T00:00:54.050Z
---

# Cost Report: Cost — SLICE-03

- Created: 2026-05-24T00:00:54.050Z
- Run Title: SLICE-03
- Window Start: 2026-05-23T23:50:19.825Z
- Window End: 2026-05-24T00:00:53.822Z
- Duration: 10.6 min (633997 ms)
- Sessions Scanned: 3
- Assistant Messages Counted: 269
- Total Tokens: 79,389,788
- Cache Hit %: 99.6%
- Total USD: $123.2398
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-AstraGenie-MemoryService: 114 msgs, $82.4546
- C--work-mega-hero-crew: 45 msgs, $37.0633
- C--work-mega-Astra-LoopObserver: 110 msgs, $3.7219

## Outcome Linkage

- Slice: SLICE-03
- Grade Avg: -
- Review Decision: pass
- Validation Decision: -

## Tokens (totals)

- input: 3,827
- cache_create_5m: 0
- cache_create_1h: 322,689
- cache_read: 78,930,016
- output: 133,256

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 159 msgs (59.11%), $119.5179 (96.98%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 110 msgs (40.89%), $3.7219 (3.02%)

## Conversation Shape

- user_msg_count: 3
- user_msg_avg_len: 5310
- turns_before_first_tool: 1
- compaction_count: 1
- skill_invocations: 0
- subagent_dispatches: 1

## Tool Usage

- Read: 53
- Bash: 39
- Edit: 36 (1 failed)
- Grep: 11
- Glob: 7
- mcp__plugin_playwright_playwright__browser_navigate: 6
- mcp__plugin_playwright_playwright__browser_snapshot: 3
- mcp__plugin_playwright_playwright__browser_take_screenshot: 3
- Write: 3 (1 failed)
- mcp__plugin_playwright_playwright__browser_click: 2
- PowerShell: 2
- mcp__plugin_playwright_playwright__browser_evaluate: 2
- ToolSearch: 1
- Agent: 1

## Tool Result Sizes (bytes)

- count: 170
- sum: 256,224
- p50: 323
- p90: 1,907
- max: 48,380

## File Re-reads

- redundant_read_count: 10
- top paths:
  - 5× C:\work\mega\AstraGenie.MemoryService\src\frontend\memory-dashboard\src\pages\ImportDataPage.tsx
  - 3× C:\work\mega\AstraGenie.MemoryService\src\frontend\memory-dashboard\src\pages\ImportMdPage.tsx
  - 3× C:\work\mega\hero-crew\scripts\validate-routing-table.mjs
  - 2× C:\work\mega\AstraGenie.MemoryService\src\MemoryService.Api\Controllers\IngestionController.cs
  - 2× C:\work\mega\AstraGenie.MemoryService\src\frontend\memory-dashboard\src\pages\SearchPlaygroundPage.tsx

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Read: 53 calls, 205,034B results, ~97,265 cache_create tok (0.47×)
- Edit: 36 calls, 7,280B results, ~57,535 cache_create tok (7.9×)
- Bash: 39 calls, 18,695B results, ~49,971 cache_create tok (2.67×)
- Grep: 11 calls, 5,512B results, ~8,041 cache_create tok (1.46×)
- Agent: 1 calls, 391B results, ~7,842 cache_create tok (20.06×)
- mcp__plugin_playwright_playwright__browser_snapshot: 3 calls, 7,439B results, ~6,504 cache_create tok (0.87×)
- Glob: 7 calls, 2,304B results, ~6,193 cache_create tok (2.69×)
- Write: 3 calls, 578B results, ~5,290 cache_create tok (9.15×)
- mcp__plugin_playwright_playwright__browser_navigate: 6 calls, 4,362B results, ~3,742 cache_create tok (0.86×)
- mcp__plugin_playwright_playwright__browser_evaluate: 2 calls, 1,140B results, ~2,270 cache_create tok (1.99×)
- mcp__plugin_playwright_playwright__browser_click: 2 calls, 2,068B results, ~2,170 cache_create tok (1.05×)
- ToolSearch: 1 calls, 284B results, ~2,038 cache_create tok (7.18×)
- mcp__plugin_playwright_playwright__browser_take_screenshot: 3 calls, 852B results, ~639 cache_create tok (0.75×)
- PowerShell: 2 calls, 20B results, ~581 cache_create tok (29.05×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 110
- usd: $3.7219
- input: 130
- cache_create_5m: 0
- cache_create_1h: 165,277
- cache_read: 7,390,530
- output: 34,178

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 159
- usd: $119.5179
- input: 3,697
- cache_create_5m: 0
- cache_create_1h: 157,412
- cache_read: 71,539,486
- output: 99,078

