---
kind: cost-report
slice: SLICE-42
run_title: "SLICE-42: Phase 3.1 entrypoint cutover — all scripts .mjs → .ts"
usd: 59.9446
duration_ms: 2966032
total_tokens: 47943479
cache_hit_pct: 98.7
review_decision: approved
source_project: aggregate
aggregate_all: true
source_count: 3
created_at: 2026-06-07T15:46:58.601Z
---

# Cost Report: SLICE-42: Phase 3.1 entrypoint cutover — all scripts .mjs → .ts

- Created: 2026-06-07T15:46:58.601Z
- Run Title: SLICE-42: Phase 3.1 entrypoint cutover — all scripts .mjs → .ts
- Window Start: 2026-06-07T14:57:28.413Z
- Window End: 2026-06-07T15:46:54.445Z
- Duration: 49.4 min (2966032 ms)
- Sessions Scanned: 3
- Assistant Messages Counted: 221
- Total Tokens: 47,943,479
- Cache Hit %: 98.7%
- Total USD: $59.9446
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-loopobserver: 55 msgs, $49.5923
- C--work-mega-hero-crew: 140 msgs, $8.6700
- C--work-mega-loop: 26 msgs, $1.6823

## Outcome Linkage

- Slice: SLICE-42
- Grade Avg: -
- Review Decision: approved
- Validation Decision: -

## Tokens (totals)

- input: 279
- cache_create_5m: 0
- cache_create_1h: 638,438
- cache_read: 47,151,846
- output: 152,916

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 55 msgs (24.89%), $49.5923 (82.73%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 166 msgs (75.11%), $10.3523 (17.27%)

## Conversation Shape

- user_msg_count: 4
- user_msg_avg_len: 3438
- turns_before_first_tool: 0
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 5

## Tool Usage

- Bash: 66 (3 failed)
- Read: 50
- Agent: 5
- Edit: 4
- Write: 3
- ToolSearch: 1
- Glob: 1
- AskUserQuestion: 1
- mcp__plugin_playwright_playwright__browser_navigate: 1
- mcp__plugin_playwright_playwright__browser_console_messages: 1

## Tool Result Sizes (bytes)

- count: 134
- sum: 214,944
- p50: 716
- p90: 3,945
- max: 12,220

## File Re-reads

- redundant_read_count: 39
- top paths:
  - 35× C:\work\mega\hero-crew\scripts\crew.ts
  - 3× C:\work\mega\hero-crew\scripts\lib\artifacts\types.ts
  - 2× C:\work\mega\hero-crew\scripts\lib\claims.ts
  - 2× C:\work\mega\hero-crew\scripts\lib\workflow-state.ts
  - 2× C:\work\mega\loopobserver\src\LoopBrain.Web\src\components\ui\DimensionDrillPopover.tsx

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Read: 50 calls, 116,804B results, ~307,278 cache_create tok (2.63×)
- Bash: 65 calls, 89,037B results, ~249,658 cache_create tok (2.8×)
- Agent: 5 calls, 4,560B results, ~53,522 cache_create tok (11.74×)
- Edit: 4 calls, 805B results, ~16,324 cache_create tok (20.28×)
- ToolSearch: 1 calls, 103B results, ~5,817 cache_create tok (56.48×)
- Write: 3 calls, 560B results, ~2,330 cache_create tok (4.16×)
- AskUserQuestion: 1 calls, 221B results, ~1,042 cache_create tok (4.71×)
- mcp__plugin_playwright_playwright__browser_navigate: 1 calls, 576B results, ~826 cache_create tok (1.43×)
- mcp__plugin_playwright_playwright__browser_console_messages: 1 calls, 353B results, ~826 cache_create tok (2.34×)
- Glob: 1 calls, 1,504B results, ~602 cache_create tok (0.4×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 166
- usd: $10.3523
- input: 214
- cache_create_5m: 0
- cache_create_1h: 539,964
- cache_read: 17,561,788
- output: 122,889

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 55
- usd: $49.5923
- input: 65
- cache_create_5m: 0
- cache_create_1h: 98,474
- cache_read: 29,590,058
- output: 30,027

