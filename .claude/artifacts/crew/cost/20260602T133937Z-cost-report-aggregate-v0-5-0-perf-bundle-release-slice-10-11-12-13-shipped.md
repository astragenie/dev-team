---
kind: cost-report
slice: SLICE-10
run_title: "v0.5.0 perf bundle release — SLICE-10/11/12/13 shipped"
usd: 2538.9064
duration_ms: 425288183
total_tokens: 1434662861
cache_hit_pct: 98.4
review_decision: rejected
source_project: aggregate
aggregate_all: true
source_count: 7
created_at: 2026-06-02T13:39:37.424Z
---

# Cost Report: v0.5.0 perf bundle release — SLICE-10/11/12/13 shipped

- Created: 2026-06-02T13:39:37.424Z
- Run Title: v0.5.0 perf bundle release — SLICE-10/11/12/13 shipped
- Window Start: 2026-05-28T15:31:27.373Z
- Window End: 2026-06-02T13:39:35.556Z
- Duration: 7088.1 min (425288183 ms)
- Sessions Scanned: 14
- Assistant Messages Counted: 6607
- Total Tokens: 1,434,662,861
- Cache Hit %: 98.4%
- Total USD: $2538.9064
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega: 1150 msgs, $948.3600
- C--work-mega-hero-crew: 1557 msgs, $581.0157
- C--work-mega-Astra-Humanizer: 1030 msgs, $392.6611
- C--work-mega-AstraGenie-MemoryService: 1112 msgs, $376.1452
- C--work-mega-hero-crew-autonomous-loop: 1694 msgs, $216.8987
- C--work-mega-authentic: 48 msgs, $13.4894
- C--work-mega-tools: 16 msgs, $10.3363

## Outcome Linkage

- Slice: SLICE-10
- Grade Avg: -
- Review Decision: rejected
- Validation Decision: -

## Tokens (totals)

- input: 32,670
- cache_create_5m: 0
- cache_create_1h: 22,276,506
- cache_read: 1,407,795,140
- output: 4,558,545

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 3873 msgs (58.62%), $2393.0407 (94.25%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 2734 msgs (41.38%), $145.8656 (5.75%)

## Conversation Shape

- user_msg_count: 311
- user_msg_avg_len: 694
- turns_before_first_tool: 1
- compaction_count: 117
- skill_invocations: 15
- subagent_dispatches: 92

## Tool Usage

- Bash: 1785 (62 failed)
- Read: 699 (9 failed)
- Edit: 602 (22 failed)
- PowerShell: 161 (33 failed)
- Write: 141 (8 failed)
- Grep: 132
- TaskUpdate: 128
- Agent: 92
- Glob: 75
- TaskCreate: 68
- AskUserQuestion: 44 (7 failed)
- ToolSearch: 18
- Skill: 15 (2 failed)
- TaskStop: 5
- mcp__plugin_playwright_playwright__browser_navigate: 2
- mcp__plugin_playwright_playwright__browser_snapshot: 2
- mcp__plugin_playwright_playwright__browser_take_screenshot: 1
- ExitPlanMode: 1

## Tool Result Sizes (bytes)

- count: 4012
- sum: 4,758,952
- p50: 258
- p90: 2,495
- max: 73,551

## File Re-reads

- redundant_read_count: 282
- top paths:
  - 18× C:\work\mega\hero-crew-autonomous-loop\scripts\lib\slice-linker.mjs
  - 18× C:\work\mega\hero-crew-autonomous-loop\src\scripts\lib\slice-linker.mts
  - 11× C:\work\mega\Astra.Humanizer\docs\superpowers\plans\2026-05-28-portal-stealth-redesign.md
  - 10× C:\work\mega\hero-crew\scripts\crew.mjs
  - 10× C:\work\mega\hero-crew\scripts\lib\artifacts.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 1791 calls, 1,639,111B results, ~6,814,324 cache_create tok (4.16×)
- TaskCreate: 68 calls, 4,589B results, ~4,707,076 cache_create tok (1025.73×)
- Read: 730 calls, 2,448,106B results, ~3,258,663 cache_create tok (1.33×)
- Edit: 602 calls, 109,332B results, ~1,763,798 cache_create tok (16.13×)
- ToolSearch: 18 calls, 1,677B results, ~1,557,139 cache_create tok (928.53×)
- PowerShell: 161 calls, 131,140B results, ~924,259 cache_create tok (7.05×)
- Agent: 92 calls, 218,976B results, ~780,363 cache_create tok (3.56×)
- AskUserQuestion: 44 calls, 12,125B results, ~742,227 cache_create tok (61.21×)
- Write: 141 calls, 27,395B results, ~634,690 cache_create tok (23.17×)
- TaskUpdate: 128 calls, 2,868B results, ~441,177 cache_create tok (153.83×)
- Grep: 133 calls, 89,051B results, ~344,749 cache_create tok (3.87×)
- Glob: 75 calls, 35,813B results, ~126,534 cache_create tok (3.53×)
- Skill: 15 calls, 7,331B results, ~101,037 cache_create tok (13.78×)
- mcp__plugin_playwright_playwright__browser_snapshot: 2 calls, 16,890B results, ~14,008 cache_create tok (0.83×)
- TaskStop: 5 calls, 3,157B results, ~7,605 cache_create tok (2.41×)
- ExitPlanMode: 1 calls, 5,957B results, ~5,730 cache_create tok (0.96×)
- mcp__plugin_playwright_playwright__browser_navigate: 2 calls, 700B results, ~587 cache_create tok (0.84×)
- mcp__plugin_playwright_playwright__browser_take_screenshot: 1 calls, 330B results, ~366 cache_create tok (1.11×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 3873
- usd: $2393.0407
- input: 15,003
- cache_create_5m: 0
- cache_create_1h: 16,986,326
- cache_read: 1,111,725,290
- output: 2,875,173

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 2734
- usd: $145.8656
- input: 17,667
- cache_create_5m: 0
- cache_create_1h: 5,290,180
- cache_read: 296,069,850
- output: 1,683,372

