---
kind: cost-report
run_title: "Rename global engineering-os to crew"
usd: 23.1658
duration_ms: 701402
total_tokens: 11913811
cache_hit_pct: 98.7
source_project: aggregate
aggregate_all: true
source_count: 2
created_at: 2026-05-26T23:26:34.210Z
---

# Cost Report: Cost — Rename global engineering-os to crew

- Created: 2026-05-26T23:26:34.210Z
- Run Title: Rename global engineering-os to crew
- Window Start: 2026-05-26T23:14:51.841Z
- Window End: 2026-05-26T23:26:33.243Z
- Duration: 11.7 min (701402 ms)
- Sessions Scanned: 2
- Assistant Messages Counted: 122
- Total Tokens: 11,913,811
- Cache Hit %: 98.7%
- Total USD: $23.1658
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-hero-crew: 106 msgs, $22.3129
- C--work-mega-AstraGenie-MemoryService: 16 msgs, $0.8529

## Tokens (totals)

- input: 1,878
- cache_create_5m: 0
- cache_create_1h: 146,751
- cache_read: 11,703,972
- output: 61,210

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 106 msgs (86.89%), $22.3129 (96.32%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 16 msgs (13.11%), $0.8529 (3.68%)

## Conversation Shape

- user_msg_count: 3
- user_msg_avg_len: 57
- turns_before_first_tool: 0
- compaction_count: 2
- skill_invocations: 0
- subagent_dispatches: 0

## Tool Usage

- Edit: 30
- Read: 28
- Bash: 19 (3 failed)
- Glob: 4
- Grep: 2
- AskUserQuestion: 1

## Tool Result Sizes (bytes)

- count: 84
- sum: 57,466
- p50: 189
- p90: 1,791
- max: 6,079

## File Re-reads

- redundant_read_count: 3
- top paths:
  - 4× C:\work\mega\hero-crew\README.md

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Read: 28 calls, 30,484B results, ~63,848 cache_create tok (2.09×)
- Edit: 30 calls, 4,627B results, ~51,889 cache_create tok (11.21×)
- Bash: 18 calls, 20,394B results, ~25,957 cache_create tok (1.27×)
- Grep: 2 calls, 1,245B results, ~1,270 cache_create tok (1.02×)
- Glob: 4 calls, 274B results, ~1,205 cache_create tok (4.4×)
- AskUserQuestion: 1 calls, 227B results, ~310 cache_create tok (1.37×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 16
- usd: $0.8529
- input: 24
- cache_create_5m: 0
- cache_create_1h: 32,600
- cache_read: 1,489,570
- output: 14,024

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 106
- usd: $22.3129
- input: 1,854
- cache_create_5m: 0
- cache_create_1h: 114,151
- cache_read: 10,214,402
- output: 47,186

