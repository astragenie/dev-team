---
kind: cost-report
run_title: "FEAT-046 Task 5 modelCompliance in brief-me"
usd: 30.964
duration_ms: 397462
total_tokens: 31033896
cache_hit_pct: 99.2
source_project: aggregate
aggregate_all: true
source_count: 3
created_at: 2026-06-05T10:29:12.143Z
---

# Cost Report: FEAT-046 Task 5 modelCompliance in brief-me

- Created: 2026-06-05T10:29:12.143Z
- Run Title: FEAT-046 Task 5 modelCompliance in brief-me
- Window Start: 2026-06-05T10:22:30.406Z
- Window End: 2026-06-05T10:29:07.868Z
- Duration: 6.6 min (397462 ms)
- Sessions Scanned: 4
- Assistant Messages Counted: 214
- Total Tokens: 31,033,896
- Cache Hit %: 99.2%
- Total USD: $30.9640
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-hero-crew: 122 msgs, $26.8518
- C--work-mega-loop: 40 msgs, $2.5815
- C--work-mega-loopobserver: 52 msgs, $1.5307

## Tokens (totals)

- input: 2,204
- cache_create_5m: 0
- cache_create_1h: 233,827
- cache_read: 30,671,827
- output: 126,038

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 57 msgs (26.64%), $23.0779 (74.53%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 157 msgs (73.36%), $7.8861 (25.47%)

## Conversation Shape

- user_msg_count: 1
- user_msg_avg_len: 28
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 4

## Tool Usage

- Bash: 61 (2 failed)
- Read: 17
- Edit: 17 (1 failed)
- TaskUpdate: 10
- PowerShell: 10
- Grep: 6
- Write: 5 (1 failed)
- Agent: 4
- mcp__plugin_playwright_playwright__browser_navigate: 3
- mcp__plugin_playwright_playwright__browser_take_screenshot: 3
- ToolSearch: 1

## Tool Result Sizes (bytes)

- count: 138
- sum: 1,054,407
- p50: 212
- p90: 2,156
- max: 606,999

## File Re-reads

- redundant_read_count: 10
- top paths:
  - 9× C:\work\mega\hero-crew\scripts\lib\workflow-state.mjs
  - 2× C:\work\mega\hero-crew\.claude\worktrees\feat-046-task-5-model-compliance\scripts\lib\briefing.mjs
  - 2× C:\work\mega\hero-crew\scripts\lib\session-cost.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 59 calls, 31,840B results, ~98,260 cache_create tok (3.09×)
- Agent: 4 calls, 6,829B results, ~28,721 cache_create tok (4.21×)
- Read: 17 calls, 29,403B results, ~25,119 cache_create tok (0.85×)
- Edit: 17 calls, 2,867B results, ~23,158 cache_create tok (8.08×)
- TaskUpdate: 10 calls, 229B results, ~15,194 cache_create tok (66.35×)
- Write: 5 calls, 963B results, ~14,062 cache_create tok (14.6×)
- mcp__plugin_playwright_playwright__browser_take_screenshot: 3 calls, 973,603B results, ~11,246 cache_create tok (0.01×)
- PowerShell: 10 calls, 3,329B results, ~7,459 cache_create tok (2.24×)
- Grep: 6 calls, 2,930B results, ~6,054 cache_create tok (2.07×)
- ToolSearch: 1 calls, 284B results, ~1,738 cache_create tok (6.12×)
- mcp__plugin_playwright_playwright__browser_navigate: 3 calls, 1,178B results, ~789 cache_create tok (0.67×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 57
- usd: $23.0779
- input: 57
- cache_create_5m: 0
- cache_create_1h: 80,012
- cache_read: 11,202,332
- output: 51,642

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 157
- usd: $7.8861
- input: 2,147
- cache_create_5m: 0
- cache_create_1h: 153,815
- cache_read: 19,469,495
- output: 74,396

