---
kind: cost-report
run_title: "fix locateSliceFile regex in loop repo"
usd: 415.9535
duration_ms: 10157914
total_tokens: 233432027
cache_hit_pct: 97.6
source_project: aggregate
aggregate_all: true
source_count: 5
created_at: 2026-05-27T02:04:10.790Z
---

# Cost Report: Cost — fix locateSliceFile regex in loop repo

- Created: 2026-05-27T02:04:10.791Z
- Run Title: fix locateSliceFile regex in loop repo
- Window Start: 2026-05-26T23:14:51.841Z
- Window End: 2026-05-27T02:04:09.755Z
- Duration: 169.3 min (10157914 ms)
- Sessions Scanned: 7
- Assistant Messages Counted: 1766
- Total Tokens: 233,432,027
- Cache Hit %: 97.6%
- Total USD: $415.9535
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-hero-crew-autonomous-loop: 571 msgs, $255.1458
- C--work-mega-hero-crew: 369 msgs, $87.3369
- C--work-mega-Astra-Humanizer: 393 msgs, $48.2159
- C--work-mega-AstraGenie-MemoryService: 408 msgs, $23.2134
- C--work-mega-Astra-LoopObserver: 25 msgs, $2.0416

## Tokens (totals)

- input: 10,065
- cache_create_5m: 0
- cache_create_1h: 5,536,470
- cache_read: 226,981,907
- output: 903,585

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 1116 msgs (63.19%), $376.3202 (90.47%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 650 msgs (36.81%), $39.6333 (9.53%)

## Conversation Shape

- user_msg_count: 126
- user_msg_avg_len: 509
- turns_before_first_tool: 1
- compaction_count: 67
- skill_invocations: 10
- subagent_dispatches: 41

## Tool Usage

- Bash: 317 (23 failed)
- Read: 233 (4 failed)
- Edit: 167 (13 failed)
- PowerShell: 93 (11 failed)
- TaskUpdate: 46
- Agent: 41
- Grep: 40
- Write: 31
- Glob: 29
- TaskCreate: 22
- ToolSearch: 18
- AskUserQuestion: 10 (1 failed)
- Skill: 10
- WebFetch: 7
- WebSearch: 4
- mcp__northstar__plan_next_artifact_generation: 3 (3 failed)
- mcp__northstar__create_product_plan: 2
- mcp__northstar__run_custom_analysis: 2
- mcp__northstar__submit_artifact_clarifications: 2 (2 failed)
- EnterPlanMode: 2
- ExitPlanMode: 2
- mcp__northstar__start_onboarding: 1
- mcp__northstar__recall_agent_memory: 1
- mcp__northstar__save_agent_memory: 1
- mcp__northstar__bootstrap_product: 1
- mcp__northstar__create_artifact_from_template: 1 (1 failed)
- mcp__northstar__get_product_context: 1

## Tool Result Sizes (bytes)

- count: 1084
- sum: 1,355,902
- p50: 215
- p90: 2,731
- max: 41,436

## File Re-reads

- redundant_read_count: 87
- top paths:
  - 12× C:\work\mega\hero-crew-autonomous-loop\scripts\lib\slice-linker.mjs
  - 10× C:\work\mega\hero-crew-autonomous-loop\scripts\lib\slice-linker\crew-bridge.mjs
  - 9× C:\work\mega\hero-crew-autonomous-loop\scripts\lib\slice-linker\slice-progress.mjs
  - 6× C:\Users\serge\.claude\skills\gstack\setup
  - 5× C:\Users\serge\.claude\CLAUDE.md

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Read: 233 calls, 641,786B results, ~1,837,039 cache_create tok (2.86×)
- Bash: 317 calls, 295,162B results, ~1,067,730 cache_create tok (3.62×)
- Edit: 167 calls, 28,441B results, ~1,031,933 cache_create tok (36.28×)
- PowerShell: 93 calls, 91,808B results, ~576,537 cache_create tok (6.28×)
- Agent: 37 calls, 141,740B results, ~483,820 cache_create tok (3.41×)
- Write: 31 calls, 5,308B results, ~153,646 cache_create tok (28.95×)
- Grep: 40 calls, 37,305B results, ~74,602 cache_create tok (2×)
- TaskUpdate: 46 calls, 1,008B results, ~43,792 cache_create tok (43.44×)
- ToolSearch: 18 calls, 1,523B results, ~38,326 cache_create tok (25.16×)
- Skill: 10 calls, 389B results, ~30,634 cache_create tok (78.75×)
- Glob: 29 calls, 7,503B results, ~25,085 cache_create tok (3.34×)
- TaskCreate: 22 calls, 1,697B results, ~20,492 cache_create tok (12.08×)
- mcp__northstar__bootstrap_product: 1 calls, 24,979B results, ~15,478 cache_create tok (0.62×)
- WebSearch: 4 calls, 12,728B results, ~15,042 cache_create tok (1.18×)
- mcp__northstar__submit_artifact_clarifications: 2 calls, 168B results, ~13,901 cache_create tok (82.74×)
- WebFetch: 7 calls, 14,252B results, ~13,680 cache_create tok (0.96×)
- ExitPlanMode: 2 calls, 13,358B results, ~11,854 cache_create tok (0.89×)
- AskUserQuestion: 10 calls, 3,188B results, ~8,945 cache_create tok (2.81×)
- EnterPlanMode: 2 calls, 1,162B results, ~7,153 cache_create tok (6.16×)
- mcp__northstar__start_onboarding: 1 calls, 22,214B results, ~6,077 cache_create tok (0.27×)
- mcp__northstar__recall_agent_memory: 1 calls, 83B results, ~5,456 cache_create tok (65.73×)
- mcp__northstar__create_product_plan: 2 calls, 3,391B results, ~3,486 cache_create tok (1.03×)
- mcp__northstar__get_product_context: 1 calls, 4,131B results, ~2,566 cache_create tok (0.62×)
- mcp__northstar__plan_next_artifact_generation: 3 calls, 342B results, ~1,912 cache_create tok (5.59×)
- mcp__northstar__run_custom_analysis: 2 calls, 1,514B results, ~1,658 cache_create tok (1.1×)
- mcp__northstar__create_artifact_from_template: 1 calls, 99B results, ~828 cache_create tok (8.36×)
- mcp__northstar__save_agent_memory: 1 calls, 408B results, ~778 cache_create tok (1.91×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 1116
- usd: $376.3202
- input: 4,140
- cache_create_5m: 0
- cache_create_1h: 3,432,982
- cache_read: 160,013,210
- output: 443,318

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 650
- usd: $39.6333
- input: 5,925
- cache_create_5m: 0
- cache_create_1h: 2,103,488
- cache_read: 66,968,697
- output: 460,267

