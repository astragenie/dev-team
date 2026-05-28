---
kind: cost-report
feature: FEAT-004
run_title: "FEAT004 SLICE08"
usd: 9.5848
duration_ms: 475667
total_tokens: 23993469
cache_hit_pct: 99.2
source_project: aggregate
aggregate_all: true
source_count: 4
created_at: 2026-05-28T16:17:10.977Z
---

# Cost Report: FEAT004 SLICE08

- Created: 2026-05-28T16:17:10.977Z
- Run Title: FEAT004 SLICE08
- Window Start: 2026-05-28T15:31:27.373Z
- Window End: 2026-05-28T15:39:23.040Z
- Duration: 7.9 min (475667 ms)
- Sessions Scanned: 4
- Assistant Messages Counted: 185
- Total Tokens: 23,993,469
- Cache Hit %: 99.2%
- Total USD: $9.5848
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-AstraGenie-MemoryService: 74 msgs, $3.7327
- C--work-mega-Astra-Humanizer: 60 msgs, $3.3340
- C--work-mega-hero-crew: 27 msgs, $1.7078
- C--work-mega-hero-crew-autonomous-loop: 24 msgs, $0.8102

## Tokens (totals)

- input: 279
- cache_create_5m: 0
- cache_create_1h: 181,991
- cache_read: 23,719,452
- output: 91,747

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 185 msgs (100%), $9.5848 (100%)

## Conversation Shape

- user_msg_count: 1
- user_msg_avg_len: 93
- turns_before_first_tool: 1
- compaction_count: 2
- skill_invocations: 1
- subagent_dispatches: 6

## Tool Usage

- Bash: 58 (3 failed)
- Read: 20
- Edit: 18 (1 failed)
- Write: 9
- Agent: 6
- TaskUpdate: 4
- Glob: 3
- Skill: 1

## Tool Result Sizes (bytes)

- count: 119
- sum: 126,022
- p50: 305
- p90: 2,712
- max: 10,506

## File Re-reads

- redundant_read_count: 9
- top paths:
  - 6× C:\work\mega\Astra.Humanizer\docs\superpowers\plans\2026-05-28-portal-stealth-redesign.md
  - 2× C:\work\mega\AstraGenie.MemoryService\src\frontend\memory-dashboard\src\api\memoryApi.ts
  - 2× C:\work\mega\AstraGenie.MemoryService\src\frontend\memory-dashboard\src\App.tsx
  - 2× C:\work\mega\hero-crew-autonomous-loop\.claude\artifacts\loop\backlog\triaged\FEAT-002.md
  - 2× C:\work\mega\hero-crew-autonomous-loop\.claude\artifacts\loop\backlog\triaged\FEAT-003.md

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 57 calls, 52,956B results, ~67,136 cache_create tok (1.27×)
- Read: 20 calls, 53,034B results, ~48,934 cache_create tok (0.92×)
- Write: 8 calls, 1,600B results, ~23,762 cache_create tok (14.85×)
- Agent: 6 calls, 10,281B results, ~20,541 cache_create tok (2×)
- Edit: 18 calls, 3,614B results, ~11,049 cache_create tok (3.06×)
- TaskUpdate: 4 calls, 88B results, ~2,858 cache_create tok (32.48×)
- Skill: 1 calls, 27B results, ~1,204 cache_create tok (44.59×)
- Glob: 3 calls, 114B results, ~723 cache_create tok (6.34×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 185
- usd: $9.5848
- input: 279
- cache_create_5m: 0
- cache_create_1h: 181,991
- cache_read: 23,719,452
- output: 91,747

