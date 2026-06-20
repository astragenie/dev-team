---
kind: cost-report
feature: FEAT-142
run_title: "FEAT142 SLICE87"
usd: 90.2473
duration_ms: 218618
total_tokens: 54854372
cache_hit_pct: 99.7
source_project: aggregate
aggregate_all: true
source_count: 5
created_at: 2026-06-20T09:44:33.543Z
---

# Cost Report: FEAT142 SLICE87

- Created: 2026-06-20T09:44:33.543Z
- Run Title: FEAT142 SLICE87
- Window Start: 2026-06-20T09:40:48.783Z
- Window End: 2026-06-20T09:44:27.401Z
- Duration: 3.6 min (218618 ms)
- Sessions Scanned: 6
- Assistant Messages Counted: 130
- Total Tokens: 54,854,372
- Cache Hit %: 99.7%
- Total USD: $90.2473
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega: 42 msgs, $34.2079
- C--work-mega-devops: 16 msgs, $19.8378
- C--work-mega-hero-crew: 25 msgs, $17.4195
- C--work-mega-loop: 10 msgs, $13.4317
- C--work-mega-memory: 37 msgs, $5.3504

## Tokens (totals)

- input: 579
- cache_create_5m: 0
- cache_create_1h: 162,151
- cache_read: 54,588,649
- output: 102,993

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 107 msgs (82.31%), $89.1889 (98.83%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 23 msgs (17.69%), $1.0583 (1.17%)

## Conversation Shape

- user_msg_count: 2
- user_msg_avg_len: 390
- turns_before_first_tool: 2
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 2

## Tool Usage

- Bash: 42 (2 failed)
- Edit: 19 (3 failed)
- Read: 13
- Write: 8
- PowerShell: 3
- Agent: 2

## Tool Result Sizes (bytes)

- count: 85
- sum: 80,623
- p50: 268
- p90: 2,356
- max: 10,306

## File Re-reads

- redundant_read_count: 1
- top paths:
  - 2× C:\work\mega\hero-crew\agents\architect.md

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 41 calls, 45,742B results, ~76,478 cache_create tok (1.67×)
- Edit: 19 calls, 3,276B results, ~21,472 cache_create tok (6.55×)
- Read: 12 calls, 28,016B results, ~21,237 cache_create tok (0.76×)
- Write: 8 calls, 1,457B results, ~18,260 cache_create tok (12.53×)
- PowerShell: 3 calls, 1,761B results, ~15,710 cache_create tok (8.92×)
- Agent: 0 calls, 0B results, ~780 cache_create tok (—)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 107
- usd: $89.1889
- input: 556
- cache_create_5m: 0
- cache_create_1h: 131,974
- cache_read: 52,512,488
- output: 86,035

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 23
- usd: $1.0583
- input: 23
- cache_create_5m: 0
- cache_create_1h: 30,177
- cache_read: 2,076,161
- output: 16,958

