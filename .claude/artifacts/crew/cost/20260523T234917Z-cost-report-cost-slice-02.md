---
kind: cost-report
slice: SLICE-02
run_title: "SLICE-02"
usd: 51.7296
duration_ms: 582263
total_tokens: 36878466
cache_hit_pct: 98.8
review_decision: pass
source_project: aggregate
aggregate_all: true
source_count: 3
created_at: 2026-05-23T23:49:17.912Z
---

# Cost Report: Cost — SLICE-02

- Created: 2026-05-23T23:49:17.912Z
- Run Title: SLICE-02
- Window Start: 2026-05-23T23:39:35.433Z
- Window End: 2026-05-23T23:49:17.696Z
- Duration: 9.7 min (582263 ms)
- Sessions Scanned: 3
- Assistant Messages Counted: 135
- Total Tokens: 36,878,466
- Cache Hit %: 98.8%
- Total USD: $51.7296
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-AstraGenie-MemoryService: 34 msgs, $23.8795
- C--work-mega-hero-crew: 29 msgs, $22.5149
- C--work-mega-Astra-LoopObserver: 72 msgs, $5.3351

## Outcome Linkage

- Slice: SLICE-02
- Grade Avg: -
- Review Decision: pass
- Validation Decision: -

## Tokens (totals)

- input: 240
- cache_create_5m: 0
- cache_create_1h: 427,950
- cache_read: 36,374,731
- output: 75,545

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 63 msgs (46.67%), $46.3944 (89.69%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 72 msgs (53.33%), $5.3351 (10.31%)

## Conversation Shape

- user_msg_count: 10
- user_msg_avg_len: 141
- turns_before_first_tool: 0
- compaction_count: 3
- skill_invocations: 0
- subagent_dispatches: 3

## Tool Usage

- Bash: 25 (1 failed)
- Read: 21
- Grep: 8
- ToolSearch: 4
- Glob: 3
- Agent: 3
- Write: 3
- TaskUpdate: 2
- mcp__plugin_playwright_playwright__browser_navigate: 1
- mcp__plugin_playwright_playwright__browser_take_screenshot: 1
- TaskCreate: 1

## Tool Result Sizes (bytes)

- count: 74
- sum: 647,309
- p50: 411
- p90: 5,011
- max: 556,099

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 25 calls, 23,202B results, ~280,221 cache_create tok (12.08×)
- Read: 21 calls, 54,893B results, ~83,836 cache_create tok (1.53×)
- Agent: 3 calls, 6,163B results, ~29,362 cache_create tok (4.76×)
- Write: 3 calls, 649B results, ~10,241 cache_create tok (15.78×)
- Grep: 8 calls, 3,488B results, ~6,583 cache_create tok (1.89×)
- mcp__plugin_playwright_playwright__browser_take_screenshot: 1 calls, 556,099B results, ~6,546 cache_create tok (0.01×)
- ToolSearch: 4 calls, 437B results, ~5,102 cache_create tok (11.68×)
- Glob: 3 calls, 42B results, ~3,391 cache_create tok (80.74×)
- TaskUpdate: 2 calls, 46B results, ~1,682 cache_create tok (36.57×)
- mcp__plugin_playwright_playwright__browser_navigate: 1 calls, 995B results, ~502 cache_create tok (0.5×)
- TaskCreate: 1 calls, 84B results, ~305 cache_create tok (3.63×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 72
- usd: $5.3351
- input: 102
- cache_create_5m: 0
- cache_create_1h: 318,162
- cache_read: 10,282,906
- output: 22,732

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 63
- usd: $46.3944
- input: 138
- cache_create_5m: 0
- cache_create_1h: 109,788
- cache_read: 26,091,825
- output: 52,813

