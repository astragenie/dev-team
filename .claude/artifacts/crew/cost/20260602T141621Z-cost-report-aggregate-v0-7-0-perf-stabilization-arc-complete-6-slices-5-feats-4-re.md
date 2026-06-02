---
kind: cost-report
run_title: "v0.7.0 perf-stabilization arc complete — 6 slices, 5 FEATs, 4 releases"
usd: 2814.8406
duration_ms: 427491849
total_tokens: 1584050210
cache_hit_pct: 98.5
source_project: aggregate
aggregate_all: true
source_count: 7
created_at: 2026-06-02T14:16:21.018Z
---

# Cost Report: v0.7.0 perf-stabilization arc complete — 6 slices, 5 FEATs, 4 releases

- Created: 2026-06-02T14:16:21.018Z
- Run Title: v0.7.0 perf-stabilization arc complete — 6 slices, 5 FEATs, 4 releases
- Window Start: 2026-05-28T15:31:27.373Z
- Window End: 2026-06-02T14:16:19.222Z
- Duration: 7124.9 min (427491849 ms)
- Sessions Scanned: 14
- Assistant Messages Counted: 6963
- Total Tokens: 1,584,050,210
- Cache Hit %: 98.5%
- Total USD: $2814.8406
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega: 1233 msgs, $1055.1913
- C--work-mega-hero-crew: 1680 msgs, $688.9322
- C--work-mega-Astra-Humanizer: 1030 msgs, $392.6611
- C--work-mega-AstraGenie-MemoryService: 1112 msgs, $376.1452
- C--work-mega-hero-crew-autonomous-loop: 1739 msgs, $240.3219
- C--work-mega-authentic: 153 msgs, $51.2527
- C--work-mega-tools: 16 msgs, $10.3363

## Tokens (totals)

- input: 37,959
- cache_create_5m: 0
- cache_create_1h: 23,865,305
- cache_read: 1,555,332,210
- output: 4,814,736

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 4193 msgs (60.22%), $2665.8928 (94.71%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 2770 msgs (39.78%), $148.9479 (5.29%)

## Conversation Shape

- user_msg_count: 326
- user_msg_avg_len: 667
- turns_before_first_tool: 1
- compaction_count: 121
- skill_invocations: 15
- subagent_dispatches: 102

## Tool Usage

- Bash: 1856 (63 failed)
- Read: 733 (9 failed)
- Edit: 646 (23 failed)
- PowerShell: 168 (35 failed)
- Write: 152 (9 failed)
- TaskUpdate: 147
- Grep: 133
- Agent: 102
- Glob: 87
- TaskCreate: 78
- AskUserQuestion: 49 (7 failed)
- ToolSearch: 20
- Skill: 15 (2 failed)
- TaskStop: 5
- mcp__plugin_playwright_playwright__browser_navigate: 2
- mcp__plugin_playwright_playwright__browser_snapshot: 2
- mcp__plugin_playwright_playwright__browser_take_screenshot: 1
- ExitPlanMode: 1

## Tool Result Sizes (bytes)

- count: 4237
- sum: 4,945,077
- p50: 250
- p90: 2,472
- max: 73,551

## File Re-reads

- redundant_read_count: 287
- top paths:
  - 18× C:\work\mega\hero-crew-autonomous-loop\scripts\lib\slice-linker.mjs
  - 18× C:\work\mega\hero-crew-autonomous-loop\src\scripts\lib\slice-linker.mts
  - 11× C:\work\mega\Astra.Humanizer\docs\superpowers\plans\2026-05-28-portal-stealth-redesign.md
  - 10× C:\work\mega\hero-crew\scripts\crew.mjs
  - 10× C:\work\mega\hero-crew\scripts\lib\artifacts.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 1862 calls, 1,718,310B results, ~7,106,406 cache_create tok (4.14×)
- TaskCreate: 78 calls, 5,238B results, ~5,018,411 cache_create tok (958.08×)
- Read: 764 calls, 2,505,676B results, ~3,317,873 cache_create tok (1.32×)
- Edit: 646 calls, 116,750B results, ~2,252,265 cache_create tok (19.29×)
- ToolSearch: 20 calls, 1,781B results, ~1,753,475 cache_create tok (984.55×)
- PowerShell: 168 calls, 135,005B results, ~935,900 cache_create tok (6.93×)
- Agent: 101 calls, 251,871B results, ~841,059 cache_create tok (3.34×)
- AskUserQuestion: 49 calls, 12,911B results, ~827,012 cache_create tok (64.05×)
- Write: 152 calls, 29,316B results, ~673,989 cache_create tok (22.99×)
- TaskUpdate: 147 calls, 3,292B results, ~466,287 cache_create tok (141.64×)
- Grep: 134 calls, 89,533B results, ~345,531 cache_create tok (3.86×)
- Glob: 87 calls, 36,625B results, ~145,590 cache_create tok (3.98×)
- Skill: 15 calls, 7,331B results, ~101,037 cache_create tok (13.78×)
- mcp__plugin_playwright_playwright__browser_snapshot: 2 calls, 16,890B results, ~14,008 cache_create tok (0.83×)
- TaskStop: 5 calls, 3,157B results, ~7,605 cache_create tok (2.41×)
- ExitPlanMode: 1 calls, 5,957B results, ~5,730 cache_create tok (0.96×)
- mcp__plugin_playwright_playwright__browser_navigate: 2 calls, 700B results, ~587 cache_create tok (0.84×)
- mcp__plugin_playwright_playwright__browser_take_screenshot: 1 calls, 330B results, ~366 cache_create tok (1.11×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 4193
- usd: $2665.8928
- input: 20,154
- cache_create_5m: 0
- cache_create_1h: 18,311,797
- cache_read: 1,255,181,159
- output: 3,112,864

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 2770
- usd: $148.9479
- input: 17,805
- cache_create_5m: 0
- cache_create_1h: 5,553,508
- cache_read: 300,151,051
- output: 1,701,872

