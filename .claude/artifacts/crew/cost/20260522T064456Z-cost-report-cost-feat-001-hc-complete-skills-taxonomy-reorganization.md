---
kind: cost-report
run_title: "FEAT-001 (HC) complete — skills taxonomy reorganization"
usd: 20.3486
duration_ms: 167904
total_tokens: 13116696
cache_hit_pct: 99.9
source_project: aggregate
aggregate_all: true
source_count: 2
created_at: 2026-05-22T06:44:56.654Z
---

# Cost Report: Cost — FEAT-001 (HC) complete — skills taxonomy reorganization

- Created: 2026-05-22T06:44:56.654Z
- Run Title: FEAT-001 (HC) complete — skills taxonomy reorganization
- Window Start: 2026-05-22T06:41:58.357Z
- Window End: 2026-05-22T06:44:46.261Z
- Duration: 2.8 min (167904 ms)
- Sessions Scanned: 2
- Assistant Messages Counted: 15
- Total Tokens: 13,116,696
- Cache Hit %: 99.9%
- Total USD: $20.3486
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega: 11 msgs, $14.9236
- C--work-mega-AstraGenie-MemoryService: 4 msgs, $5.4251

## Tokens (totals)

- input: 45
- cache_create_5m: 0
- cache_create_1h: 9,308
- cache_read: 13,101,796
- output: 5,547

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 15 msgs (100%), $20.3486 (100%)

## Conversation Shape

- user_msg_count: 3
- user_msg_avg_len: 192
- turns_before_first_tool: 1
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 0

## Tool Usage

- Bash: 4
- Read: 1
- Edit: 1

## Tool Result Sizes (bytes)

- count: 5
- sum: 1,835
- p50: 278
- p90: 804
- max: 804

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 3 calls, 1,424B results, ~7,230 cache_create tok (5.08×)
- Read: 1 calls, 246B results, ~577 cache_create tok (2.35×)
- Edit: 1 calls, 165B results, ~433 cache_create tok (2.62×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 15
- usd: $20.3486
- input: 45
- cache_create_5m: 0
- cache_create_1h: 9,308
- cache_read: 13,101,796
- output: 5,547

