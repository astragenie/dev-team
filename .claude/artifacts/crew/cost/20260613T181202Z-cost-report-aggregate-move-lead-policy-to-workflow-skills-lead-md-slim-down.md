---
kind: cost-report
run_title: "Move lead policy to workflow skills (lead.md slim-down)"
usd: 186.2709
duration_ms: 1692002
total_tokens: 117428312
cache_hit_pct: 99.7
source_project: aggregate
aggregate_all: true
source_count: 5
created_at: 2026-06-13T18:12:02.253Z
---

# Cost Report: Move lead policy to workflow skills (lead.md slim-down)

- Created: 2026-06-13T18:12:02.253Z
- Run Title: Move lead policy to workflow skills (lead.md slim-down)
- Window Start: 2026-06-13T17:43:43.621Z
- Window End: 2026-06-13T18:11:55.623Z
- Duration: 28.2 min (1692002 ms)
- Sessions Scanned: 5
- Assistant Messages Counted: 268
- Total Tokens: 117,428,312
- Cache Hit %: 99.7%
- Total USD: $186.2709
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-loopobserver: 60 msgs, $81.0620
- C--work-mega-common: 117 msgs, $58.3650
- C--work-mega-cortex: 27 msgs, $29.5075
- C--work-mega-hero-crew: 23 msgs, $14.9572
- C--work-mega-loop: 41 msgs, $2.3791

## Tokens (totals)

- input: 5,681
- cache_create_5m: 0
- cache_create_1h: 298,069
- cache_read: 116,973,907
- output: 150,655

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 227 msgs (84.7%), $183.8918 (98.72%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 41 msgs (15.3%), $2.3791 (1.28%)

## Conversation Shape

- user_msg_count: 18
- user_msg_avg_len: 530
- turns_before_first_tool: 5
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 8

## Tool Usage

- Bash: 92 (2 failed)
- Read: 17
- Edit: 16 (2 failed)
- Agent: 8
- PowerShell: 5 (4 failed)
- Write: 4 (1 failed)
- AskUserQuestion: 1
- Grep: 1

## Tool Result Sizes (bytes)

- count: 144
- sum: 140,120
- p50: 295
- p90: 2,012
- max: 23,106

## File Re-reads

- redundant_read_count: 5
- top paths:
  - 3× C:\work\mega\loop\.claude\artifacts\loop\backlog\pending\FEAT-200.md
  - 2× C:\work\mega\authentic\web\vite.config.ts
  - 2× C:\work\mega\hero-crew\.claude\artifacts\loop\ai-loop\slices\pending\SLICE_74_MOVE-LEAD-POLICY-TO-WORKFLOW-SKILLS-LEAD-MD-SLIM-DOWN.md
  - 2× C:\work\mega\loop\.claude\artifacts\loop\backlog\in-progress\FEAT-200.md

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 92 calls, 62,595B results, ~170,641 cache_create tok (2.73×)
- Agent: 7 calls, 10,381B results, ~38,620 cache_create tok (3.72×)
- PowerShell: 5 calls, 14,143B results, ~27,076 cache_create tok (1.91×)
- Read: 17 calls, 26,471B results, ~26,061 cache_create tok (0.98×)
- Edit: 16 calls, 2,585B results, ~23,162 cache_create tok (8.96×)
- Write: 4 calls, 572B results, ~4,942 cache_create tok (8.64×)
- AskUserQuestion: 1 calls, 167B results, ~3,100 cache_create tok (18.56×)
- Grep: 1 calls, 100B results, ~1,041 cache_create tok (10.41×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 227
- usd: $183.8918
- input: 5,616
- cache_create_5m: 0
- cache_create_1h: 256,785
- cache_read: 110,958,814
- output: 128,877

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 41
- usd: $2.3791
- input: 65
- cache_create_5m: 0
- cache_create_1h: 41,284
- cache_read: 6,015,093
- output: 21,778

