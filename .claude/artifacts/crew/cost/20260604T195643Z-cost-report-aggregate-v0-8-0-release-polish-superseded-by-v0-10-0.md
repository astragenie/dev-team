---
kind: cost-report
run_title: "v0.8.0 release polish — superseded by v0.10.0"
usd: 2309.4842
duration_ms: 23801398
total_tokens: 1090326983
cache_hit_pct: 98.3
source_project: aggregate
aggregate_all: true
source_count: 3
created_at: 2026-06-04T19:56:43.295Z
---

# Cost Report: v0.8.0 release polish — superseded by v0.10.0

- Created: 2026-06-04T19:56:43.295Z
- Run Title: v0.8.0 release polish — superseded by v0.10.0
- Window Start: 2026-06-04T13:20:00.285Z
- Window End: 2026-06-04T19:56:41.683Z
- Duration: 396.7 min (23801398 ms)
- Sessions Scanned: 7
- Assistant Messages Counted: 2381
- Total Tokens: 1,090,326,983
- Cache Hit %: 98.3%
- Total USD: $2309.4842
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-loop: 1345 msgs, $1319.1295
- C--work-mega-loopobserver: 466 msgs, $565.8302
- C--work-mega-hero-crew: 570 msgs, $424.5245

## Tokens (totals)

- input: 5,476
- cache_create_5m: 0
- cache_create_1h: 18,532,167
- cache_read: 1,069,806,306
- output: 1,983,034

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 2381 msgs (100%), $2309.4842 (100%)

## Conversation Shape

- user_msg_count: 130
- user_msg_avg_len: 131
- turns_before_first_tool: 1
- compaction_count: 73
- skill_invocations: 6
- subagent_dispatches: 49

## Tool Usage

- Bash: 638 (8 failed)
- Read: 218 (2 failed)
- Edit: 186 (33 failed)
- TaskUpdate: 93
- Write: 71 (8 failed)
- Agent: 49 (2 failed)
- TaskCreate: 49
- Grep: 47
- AskUserQuestion: 42 (2 failed)
- mcp__plugin_playwright_playwright__browser_navigate: 15
- mcp__plugin_playwright_playwright__browser_evaluate: 12
- PowerShell: 8
- Glob: 7
- Skill: 6
- mcp__plugin_playwright_playwright__browser_take_screenshot: 5
- ToolSearch: 3
- mcp__plugin_playwright_playwright__browser_snapshot: 2
- mcp__plugin_playwright_playwright__browser_click: 1

## Tool Result Sizes (bytes)

- count: 1454
- sum: 1,586,752
- p50: 241
- p90: 1,742
- max: 72,780

## File Re-reads

- redundant_read_count: 70
- top paths:
  - 15× C:\work\mega\loop\src\scripts\lib\slice-linker\start-slice.mts
  - 8× C:\work\mega\loop\src\scripts\lib\slice-linker\agent-report-writer.mts
  - 6× C:\work\mega\loop\src\scripts\lib\slice-linker\complete-slice.mts
  - 6× C:\work\mega\loop\src\tests\slice-complete-docwriter.test.mts
  - 5× C:\work\mega\hero-crew\agents\lead.md

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 638 calls, 386,820B results, ~4,231,194 cache_create tok (10.94×)
- Read: 218 calls, 946,578B results, ~2,973,351 cache_create tok (3.14×)
- AskUserQuestion: 42 calls, 9,175B results, ~2,583,003 cache_create tok (281.53×)
- Write: 71 calls, 13,064B results, ~1,888,779 cache_create tok (144.58×)
- TaskUpdate: 93 calls, 2,100B results, ~1,608,216 cache_create tok (765.82×)
- TaskCreate: 49 calls, 3,199B results, ~1,482,989 cache_create tok (463.58×)
- Edit: 186 calls, 29,869B results, ~1,438,713 cache_create tok (48.17×)
- PowerShell: 8 calls, 245B results, ~955,232 cache_create tok (3898.91×)
- ToolSearch: 3 calls, 287B results, ~540,244 cache_create tok (1882.38×)
- Agent: 48 calls, 95,211B results, ~464,793 cache_create tok (4.88×)
- Grep: 47 calls, 53,369B results, ~105,004 cache_create tok (1.97×)
- Skill: 6 calls, 269B results, ~49,139 cache_create tok (182.67×)
- mcp__plugin_playwright_playwright__browser_snapshot: 2 calls, 24,078B results, ~32,949 cache_create tok (1.37×)
- mcp__plugin_playwright_playwright__browser_evaluate: 12 calls, 9,223B results, ~14,149 cache_create tok (1.53×)
- mcp__plugin_playwright_playwright__browser_navigate: 15 calls, 7,259B results, ~8,833 cache_create tok (1.22×)
- Glob: 7 calls, 2,373B results, ~7,623 cache_create tok (3.21×)
- mcp__plugin_playwright_playwright__browser_take_screenshot: 5 calls, 1,437B results, ~1,694 cache_create tok (1.18×)
- mcp__plugin_playwright_playwright__browser_click: 1 calls, 368B results, ~758 cache_create tok (2.06×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 2381
- usd: $2309.4842
- input: 5,476
- cache_create_5m: 0
- cache_create_1h: 18,532,167
- cache_read: 1,069,806,306
- output: 1,983,034

