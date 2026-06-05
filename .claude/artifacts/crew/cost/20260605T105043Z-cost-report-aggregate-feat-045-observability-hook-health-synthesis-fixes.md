---
kind: cost-report
run_title: "FEAT-045 observability hook health + synthesis fixes"
usd: 48.7558
duration_ms: 734278
total_tokens: 46654099
cache_hit_pct: 98.0
source_project: aggregate
aggregate_all: true
source_count: 3
created_at: 2026-06-05T10:50:43.925Z
---

# Cost Report: FEAT-045 observability hook health + synthesis fixes

- Created: 2026-06-05T10:50:43.925Z
- Run Title: FEAT-045 observability hook health + synthesis fixes
- Window Start: 2026-06-05T10:38:26.973Z
- Window End: 2026-06-05T10:50:41.251Z
- Duration: 12.2 min (734278 ms)
- Sessions Scanned: 4
- Assistant Messages Counted: 371
- Total Tokens: 46,654,099
- Cache Hit %: 98.0%
- Total USD: $48.7558
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-hero-crew: 169 msgs, $39.0440
- C--work-mega-loopobserver: 112 msgs, $6.1623
- C--work-mega-loop: 90 msgs, $3.5495

## Tokens (totals)

- input: 600
- cache_create_5m: 0
- cache_create_1h: 951,696
- cache_read: 45,574,486
- output: 127,317

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 57 msgs (15.36%), $34.3271 (70.41%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 314 msgs (84.64%), $14.4287 (29.59%)

## Conversation Shape

- user_msg_count: 10
- user_msg_avg_len: 2643
- turns_before_first_tool: 0
- compaction_count: 42
- skill_invocations: 0
- subagent_dispatches: 1

## Tool Usage

- Bash: 113 (1 failed)
- Read: 39
- Edit: 33 (2 failed)
- Write: 6
- mcp__plugin_playwright_playwright__browser_navigate: 6
- mcp__plugin_playwright_playwright__browser_take_screenshot: 6
- PowerShell: 3 (1 failed)
- ExitWorktree: 1
- Agent: 1
- Glob: 1
- ToolSearch: 1
- Grep: 1

## Tool Result Sizes (bytes)

- count: 213
- sum: 2,973,782
- p50: 292
- p90: 2,493
- max: 617,207

## File Re-reads

- redundant_read_count: 13
- top paths:
  - 6× C:\work\mega\loopobserver\src\LoopBrain.Web\src\pages\CostPage.tsx
  - 4× C:/work/mega/hero-crew/scripts/lib/wakeup.mjs
  - 3× C:/work/mega/hero-crew/scripts/lib/briefing/collect.mjs
  - 3× C:/work/mega/hero-crew/scripts/lib/briefing.mjs
  - 2× C:\work\mega\loopobserver\src\LoopBrain.Web\src\components\charts\BarSlice.tsx

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 113 calls, 78,202B results, ~721,578 cache_create tok (9.23×)
- Read: 39 calls, 58,956B results, ~146,002 cache_create tok (2.48×)
- mcp__plugin_playwright_playwright__browser_take_screenshot: 6 calls, 2,820,018B results, ~33,399 cache_create tok (0.01×)
- Edit: 33 calls, 5,328B results, ~27,929 cache_create tok (5.24×)
- Agent: 1 calls, 4,048B results, ~6,540 cache_create tok (1.62×)
- Write: 6 calls, 898B results, ~6,509 cache_create tok (7.25×)
- mcp__plugin_playwright_playwright__browser_navigate: 6 calls, 2,853B results, ~4,437 cache_create tok (1.56×)
- ToolSearch: 1 calls, 192B results, ~1,322 cache_create tok (6.89×)
- Glob: 1 calls, 35B results, ~1,128 cache_create tok (32.23×)
- PowerShell: 3 calls, 719B results, ~970 cache_create tok (1.35×)
- Grep: 1 calls, 290B results, ~882 cache_create tok (3.04×)
- ExitWorktree: 1 calls, 173B results, ~560 cache_create tok (3.24×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 57
- usd: $34.3271
- input: 244
- cache_create_5m: 0
- cache_create_1h: 455,562
- cache_read: 13,354,714
- output: 8,327

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 314
- usd: $14.4287
- input: 356
- cache_create_5m: 0
- cache_create_1h: 496,134
- cache_read: 32,219,772
- output: 118,990

