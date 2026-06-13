---
kind: cost-report
run_title: "Move lead policy to workflow skills (lead.md slim-down)"
usd: 14.9572
duration_ms: 1692002
total_tokens: 7134158
cache_hit_pct: 98.9
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-13T18:11:56.329Z
---

# Cost Report: Move lead policy to workflow skills (lead.md slim-down)

- Created: 2026-06-13T18:11:56.329Z
- Run Title: Move lead policy to workflow skills (lead.md slim-down)
- Window Start: 2026-06-13T17:43:43.621Z
- Window End: 2026-06-13T18:11:55.623Z
- Duration: 28.2 min (1692002 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 23
- Total Tokens: 7,134,158
- Cache Hit %: 98.9%
- Total USD: $14.9572
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 5,267
- cache_create_5m: 0
- cache_create_1h: 69,908
- cache_read: 7,029,153
- output: 29,830

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 23 msgs (100%), $14.9572 (100%)

## Conversation Shape

- user_msg_count: 0
- user_msg_avg_len: 0
- turns_before_first_tool: 2
- compaction_count: 0
- skill_invocations: 0
- subagent_dispatches: 4

## Tool Usage

- Agent: 4
- Read: 3
- Edit: 3
- AskUserQuestion: 1
- Grep: 1
- Bash: 1

## Tool Result Sizes (bytes)

- count: 13
- sum: 33,525
- p50: 425
- p90: 4,279
- max: 23,106

## File Re-reads

- redundant_read_count: 1
- top paths:
  - 2× C:\work\mega\hero-crew\.claude\artifacts\loop\ai-loop\slices\pending\SLICE_74_MOVE-LEAD-POLICY-TO-WORKFLOW-SKILLS-LEAD-MD-SLIM-DOWN.md

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Agent: 3 calls, 6,885B results, ~20,900 cache_create tok (3.04×)
- Bash: 1 calls, 425B results, ~5,322 cache_create tok (12.52×)
- Edit: 3 calls, 522B results, ~4,832 cache_create tok (9.26×)
- AskUserQuestion: 1 calls, 167B results, ~3,100 cache_create tok (18.56×)
- Read: 3 calls, 2,320B results, ~2,877 cache_create tok (1.24×)
- Grep: 1 calls, 100B results, ~1,041 cache_create tok (10.41×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 23
- usd: $14.9572
- input: 5,267
- cache_create_5m: 0
- cache_create_1h: 69,908
- cache_read: 7,029,153
- output: 29,830

