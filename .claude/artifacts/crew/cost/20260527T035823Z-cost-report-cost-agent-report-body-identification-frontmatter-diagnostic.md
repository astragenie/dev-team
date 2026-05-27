---
kind: cost-report
run_title: "agent-report body identification + frontmatter + diagnostic"
usd: 23.512
duration_ms: 432037
total_tokens: 14724538
cache_hit_pct: 97.7
source_project: aggregate
aggregate_all: true
source_count: 4
created_at: 2026-05-27T03:58:23.190Z
---

# Cost Report: Cost — agent-report body identification + frontmatter + diagnostic

- Created: 2026-05-27T03:58:23.190Z
- Run Title: agent-report body identification + frontmatter + diagnostic
- Window Start: 2026-05-27T03:51:10.179Z
- Window End: 2026-05-27T03:58:22.216Z
- Duration: 7.2 min (432037 ms)
- Sessions Scanned: 4
- Assistant Messages Counted: 107
- Total Tokens: 14,724,538
- Cache Hit %: 97.7%
- Total USD: $23.5120
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-hero-crew: 56 msgs, $16.3917
- C--work-mega-hero-crew-autonomous-loop: 19 msgs, $4.3692
- C--work-mega-Astra-Humanizer: 22 msgs, $2.1874
- C--work-mega-Astra-LoopObserver: 10 msgs, $0.5636

## Tokens (totals)

- input: 141
- cache_create_5m: 0
- cache_create_1h: 336,463
- cache_read: 14,349,316
- output: 38,618

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 75 msgs (70.09%), $20.7609 (88.3%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 32 msgs (29.91%), $2.7511 (11.7%)

## Conversation Shape

- user_msg_count: 9
- user_msg_avg_len: 1726
- turns_before_first_tool: 1
- compaction_count: 4
- skill_invocations: 1
- subagent_dispatches: 2

## Tool Usage

- Bash: 28 (2 failed)
- Read: 11
- Edit: 10
- Grep: 5
- Write: 2
- Agent: 2
- Glob: 2
- PowerShell: 1
- Skill: 1

## Tool Result Sizes (bytes)

- count: 64
- sum: 74,282
- p50: 268
- p90: 2,087
- max: 22,288

## File Re-reads

- redundant_read_count: 4
- top paths:
  - 5× C:\work\mega\hero-crew-autonomous-loop\scripts\lib\slice-linker\agent-report-writer.mjs

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- PowerShell: 1 calls, 335B results, ~224,585 cache_create tok (670.4×)
- Bash: 28 calls, 38,845B results, ~45,487 cache_create tok (1.17×)
- Read: 11 calls, 25,454B results, ~32,562 cache_create tok (1.28×)
- Edit: 10 calls, 1,890B results, ~19,149 cache_create tok (10.13×)
- Agent: 2 calls, 3,604B results, ~6,192 cache_create tok (1.72×)
- Grep: 5 calls, 3,382B results, ~4,167 cache_create tok (1.23×)
- Glob: 2 calls, 72B results, ~1,542 cache_create tok (21.42×)
- Write: 2 calls, 378B results, ~1,475 cache_create tok (3.9×)
- Skill: 1 calls, 36B results, ~716 cache_create tok (19.89×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 32
- usd: $2.7511
- input: 45
- cache_create_5m: 0
- cache_create_1h: 240,989
- cache_read: 3,896,785
- output: 9,065

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 75
- usd: $20.7609
- input: 96
- cache_create_5m: 0
- cache_create_1h: 95,474
- cache_read: 10,452,531
- output: 29,553

