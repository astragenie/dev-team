---
kind: cost-report
feature: FEAT-160
run_title: "FEAT160 SLICE86"
usd: 3.1899
duration_ms: 38555
total_tokens: 1860156
cache_hit_pct: 99.9
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-20T09:21:42.398Z
---

# Cost Report: FEAT160 SLICE86

- Created: 2026-06-20T09:21:42.398Z
- Run Title: FEAT160 SLICE86
- Window Start: 2026-06-20T09:21:02.803Z
- Window End: 2026-06-20T09:21:41.358Z
- Duration: 0.6 min (38555 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 5
- Total Tokens: 1,860,156
- Cache Hit %: 99.9%
- Total USD: $3.1899
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 5
- cache_create_5m: 0
- cache_create_1h: 1,740
- cache_read: 1,853,649
- output: 4,762

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 5 msgs (100%), $3.1899 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 1
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 0

## Tool Usage

- Bash: 2

## Tool Result Sizes (bytes)

- count: 3
- sum: 1,655
- p50: 206
- p90: 1,354
- max: 1,354

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 2 calls, 1,560B results, ~1,254 cache_create tok (0.8×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 5
- usd: $3.1899
- input: 5
- cache_create_5m: 0
- cache_create_1h: 1,740
- cache_read: 1,853,649
- output: 4,762

