---
kind: cost-report
slice: SLICE-08
run_title: "SLICE-08 in-flight — noImplicitAny partial; 3 agents running"
usd: 9.5198
duration_ms: 475667
total_tokens: 23846028
cache_hit_pct: 99.2
source_project: aggregate
aggregate_all: true
source_count: 4
created_at: 2026-05-28T15:39:24.312Z
---

# Cost Report: SLICE-08 in-flight — noImplicitAny partial; 3 agents running

- Created: 2026-05-28T15:39:24.312Z
- Run Title: SLICE-08 in-flight — noImplicitAny partial; 3 agents running
- Window Start: 2026-05-28T15:31:27.373Z
- Window End: 2026-05-28T15:39:23.040Z
- Duration: 7.9 min (475667 ms)
- Sessions Scanned: 4
- Assistant Messages Counted: 184
- Total Tokens: 23,846,028
- Cache Hit %: 99.2%
- Total USD: $9.5198
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-AstraGenie-MemoryService: 74 msgs, $3.7327
- C--work-mega-Astra-Humanizer: 60 msgs, $3.3340
- C--work-mega-hero-crew: 26 msgs, $1.6428
- C--work-mega-hero-crew-autonomous-loop: 24 msgs, $0.8102

## Outcome Linkage

- Slice: SLICE-08
- Grade Avg: -
- Review Decision: -
- Validation Decision: -

## Tokens (totals)

- input: 278
- cache_create_5m: 0
- cache_create_1h: 179,161
- cache_read: 23,575,162
- output: 91,427

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 184 msgs (100%), $9.5198 (100%)

## Conversation Shape

- user_msg_count: 1
- user_msg_avg_len: 93
- turns_before_first_tool: 1
- compaction_count: 2
- skill_invocations: 1
- subagent_dispatches: 6

## Tool Usage

- Bash: 57 (3 failed)
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

- Bash: 57 calls, 52,956B results, ~63,167 cache_create tok (1.19×)
- Read: 20 calls, 53,034B results, ~48,934 cache_create tok (0.92×)
- Write: 8 calls, 1,600B results, ~23,762 cache_create tok (14.85×)
- Agent: 6 calls, 10,281B results, ~20,541 cache_create tok (2×)
- Edit: 18 calls, 3,614B results, ~12,188 cache_create tok (3.37×)
- TaskUpdate: 4 calls, 88B results, ~2,858 cache_create tok (32.48×)
- Skill: 1 calls, 27B results, ~1,204 cache_create tok (44.59×)
- Glob: 3 calls, 114B results, ~723 cache_create tok (6.34×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 184
- usd: $9.5198
- input: 278
- cache_create_5m: 0
- cache_create_1h: 179,161
- cache_read: 23,575,162
- output: 91,427

