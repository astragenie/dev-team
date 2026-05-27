---
kind: cost-report
run_title: "FEAT-002+003 bugfixes + performance plan Phases 1-3"
usd: 167.7437
duration_ms: 3929043
total_tokens: 123609063
cache_hit_pct: 98.4
source_project: aggregate
aggregate_all: true
source_count: 4
created_at: 2026-05-27T04:56:40.263Z
---

# Cost Report: Cost — FEAT-002+003 bugfixes + performance plan Phases 1-3

- Created: 2026-05-27T04:56:40.263Z
- Run Title: FEAT-002+003 bugfixes + performance plan Phases 1-3
- Window Start: 2026-05-27T03:51:10.179Z
- Window End: 2026-05-27T04:56:39.222Z
- Duration: 65.5 min (3929043 ms)
- Sessions Scanned: 4
- Assistant Messages Counted: 878
- Total Tokens: 123,609,063
- Cache Hit %: 98.4%
- Total USD: $167.7437
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-hero-crew: 194 msgs, $85.9606
- C--work-mega-hero-crew-autonomous-loop: 181 msgs, $56.9272
- C--work-mega-Astra-LoopObserver: 275 msgs, $13.4876
- C--work-mega-Astra-Humanizer: 228 msgs, $11.3683

## Tokens (totals)

- input: 11,081
- cache_create_5m: 0
- cache_create_1h: 1,986,325
- cache_read: 121,271,608
- output: 340,049

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 375 msgs (42.71%), $142.8878 (85.18%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 503 msgs (57.29%), $24.8558 (14.82%)

## Conversation Shape

- user_msg_count: 41
- user_msg_avg_len: 724
- turns_before_first_tool: 1
- compaction_count: 20
- skill_invocations: 9
- subagent_dispatches: 29

## Tool Usage

- Bash: 273 (17 failed)
- Read: 80 (1 failed)
- Write: 32 (2 failed)
- Edit: 32
- Agent: 29
- mcp__plugin_playwright_playwright__browser_navigate: 11
- mcp__plugin_playwright_playwright__browser_take_screenshot: 11
- PowerShell: 9
- Skill: 9
- Grep: 8
- ToolSearch: 8
- Glob: 7
- AskUserQuestion: 7 (1 failed)
- TaskCreate: 7
- TaskUpdate: 5
- mcp__plugin_playwright_playwright__browser_click: 3 (1 failed)
- ExitPlanMode: 3 (1 failed)
- mcp__plugin_playwright_playwright__browser_console_messages: 2
- EnterPlanMode: 1

## Tool Result Sizes (bytes)

- count: 538
- sum: 5,043,426
- p50: 232
- p90: 3,105
- max: 555,994

## File Re-reads

- redundant_read_count: 19
- top paths:
  - 6× C:\work\mega\hero-crew\scripts\crew.mjs
  - 5× C:\work\mega\hero-crew-autonomous-loop\scripts\lib\slice-linker\agent-report-writer.mjs
  - 3× C:\work\mega\hero-crew\scripts\lib\cost-advisor.mjs
  - 3× C:\work\mega\hero-crew-autonomous-loop\scripts\lib\grade-writer.mjs
  - 3× C:\work\mega\hero-crew-autonomous-loop\scripts\lib\grade-parser.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 273 calls, 226,950B results, ~1,149,459 cache_create tok (5.06×)
- PowerShell: 9 calls, 541B results, ~226,919 cache_create tok (419.44×)
- Read: 80 calls, 215,426B results, ~211,482 cache_create tok (0.98×)
- Agent: 28 calls, 62,523B results, ~152,882 cache_create tok (2.45×)
- Edit: 32 calls, 5,629B results, ~56,353 cache_create tok (10.01×)
- mcp__plugin_playwright_playwright__browser_take_screenshot: 11 calls, 4,494,040B results, ~43,886 cache_create tok (0.01×)
- Write: 32 calls, 5,605B results, ~36,026 cache_create tok (6.43×)
- Skill: 9 calls, 353B results, ~28,673 cache_create tok (81.23×)
- AskUserQuestion: 7 calls, 2,247B results, ~21,554 cache_create tok (9.59×)
- TaskCreate: 7 calls, 544B results, ~15,087 cache_create tok (27.73×)
- Grep: 8 calls, 9,438B results, ~8,261 cache_create tok (0.88×)
- ToolSearch: 8 calls, 742B results, ~7,810 cache_create tok (10.53×)
- mcp__plugin_playwright_playwright__browser_navigate: 11 calls, 3,936B results, ~7,500 cache_create tok (1.91×)
- ExitPlanMode: 3 calls, 9,701B results, ~6,347 cache_create tok (0.65×)
- TaskUpdate: 5 calls, 110B results, ~4,816 cache_create tok (43.78×)
- mcp__plugin_playwright_playwright__browser_console_messages: 2 calls, 3,461B results, ~3,419 cache_create tok (0.99×)
- Glob: 7 calls, 206B results, ~2,938 cache_create tok (14.26×)
- EnterPlanMode: 1 calls, 581B results, ~1,503 cache_create tok (2.59×)
- mcp__plugin_playwright_playwright__browser_click: 3 calls, 1,107B results, ~822 cache_create tok (0.74×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 503
- usd: $24.8558
- input: 642
- cache_create_5m: 0
- cache_create_1h: 935,887
- cache_read: 55,785,548
- output: 166,862

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 375
- usd: $142.8878
- input: 10,439
- cache_create_5m: 0
- cache_create_1h: 1,050,438
- cache_read: 65,486,060
- output: 173,187

