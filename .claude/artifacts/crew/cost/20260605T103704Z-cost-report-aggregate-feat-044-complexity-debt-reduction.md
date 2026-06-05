---
kind: cost-report
run_title: "FEAT-044 complexity debt reduction"
usd: 160.5858
duration_ms: 2498977
total_tokens: 131819356
cache_hit_pct: 98.1
source_project: aggregate
aggregate_all: true
source_count: 3
created_at: 2026-06-05T10:37:04.524Z
---

# Cost Report: FEAT-044 complexity debt reduction

- Created: 2026-06-05T10:37:04.524Z
- Run Title: FEAT-044 complexity debt reduction
- Window Start: 2026-06-05T09:55:22.780Z
- Window End: 2026-06-05T10:37:01.757Z
- Duration: 41.6 min (2498977 ms)
- Sessions Scanned: 5
- Assistant Messages Counted: 947
- Total Tokens: 131,819,356
- Cache Hit %: 98.1%
- Total USD: $160.5858
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-hero-crew: 648 msgs, $144.6757
- C--work-mega-loopobserver: 240 msgs, $11.9835
- C--work-mega-loop: 59 msgs, $3.9266

## Tokens (totals)

- input: 3,415
- cache_create_5m: 0
- cache_create_1h: 2,449,447
- cache_read: 128,820,080
- output: 546,414

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 260 msgs (27.46%), $123.7958 (77.09%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 687 msgs (72.54%), $36.7900 (22.91%)

## Conversation Shape

- user_msg_count: 22
- user_msg_avg_len: 1937
- turns_before_first_tool: 1
- compaction_count: 103
- skill_invocations: 0
- subagent_dispatches: 13

## Tool Usage

- Bash: 262 (9 failed)
- Read: 90 (2 failed)
- Edit: 34 (1 failed)
- TaskUpdate: 30
- Grep: 18
- Glob: 16 (1 failed)
- TaskCreate: 15
- PowerShell: 14
- Agent: 13
- Write: 10 (1 failed)
- ToolSearch: 8
- mcp__plugin_playwright_playwright__browser_navigate: 7
- mcp__plugin_playwright_playwright__browser_take_screenshot: 6
- EnterWorktree: 2
- ExitWorktree: 2 (1 failed)
- mcp__plugin_playwright_playwright__browser_snapshot: 1
- mcp__plugin_playwright_playwright__browser_evaluate: 1 (1 failed)

## Tool Result Sizes (bytes)

- count: 535
- sum: 2,571,527
- p50: 229
- p90: 2,881
- max: 606,999

## File Re-reads

- redundant_read_count: 37
- top paths:
  - 9× C:\work\mega\hero-crew\scripts\crew.mjs
  - 9× C:\work\mega\hero-crew\scripts\lib\workflow-state.mjs
  - 5× C:\work\mega\hero-crew\scripts\lib\briefing\collect.mjs
  - 4× C:\work\mega\hero-crew\scripts\lib\cost-hygiene\cost-slice-handler.mjs
  - 4× C:\work\mega\hero-crew\scripts\lib\cost-advisor.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 262 calls, 179,149B results, ~1,182,455 cache_create tok (6.6×)
- Glob: 17 calls, 17,223B results, ~440,021 cache_create tok (25.55×)
- Read: 93 calls, 370,101B results, ~374,038 cache_create tok (1.01×)
- Agent: 11 calls, 17,818B results, ~104,251 cache_create tok (5.85×)
- Edit: 34 calls, 5,868B results, ~47,891 cache_create tok (8.16×)
- TaskUpdate: 30 calls, 672B results, ~44,681 cache_create tok (66.49×)
- Grep: 18 calls, 18,597B results, ~39,178 cache_create tok (2.11×)
- Write: 10 calls, 1,984B results, ~37,415 cache_create tok (18.86×)
- mcp__plugin_playwright_playwright__browser_take_screenshot: 6 calls, 1,945,254B results, ~25,726 cache_create tok (0.01×)
- ToolSearch: 8 calls, 802B results, ~19,642 cache_create tok (24.49×)
- PowerShell: 14 calls, 3,935B results, ~12,136 cache_create tok (3.08×)
- TaskCreate: 15 calls, 949B results, ~7,987 cache_create tok (8.42×)
- mcp__plugin_playwright_playwright__browser_navigate: 7 calls, 3,306B results, ~4,166 cache_create tok (1.26×)
- EnterWorktree: 2 calls, 534B results, ~850 cache_create tok (1.59×)
- ExitWorktree: 2 calls, 465B results, ~595 cache_create tok (1.28×)
- mcp__plugin_playwright_playwright__browser_snapshot: 1 calls, 441B results, ~341 cache_create tok (0.77×)
- mcp__plugin_playwright_playwright__browser_evaluate: 1 calls, 181B results, ~256 cache_create tok (1.41×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 260
- usd: $123.7958
- input: 514
- cache_create_5m: 0
- cache_create_1h: 1,420,297
- cache_read: 45,126,878
- output: 179,852

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 687
- usd: $36.7900
- input: 2,901
- cache_create_5m: 0
- cache_create_1h: 1,029,150
- cache_read: 83,693,202
- output: 366,562

