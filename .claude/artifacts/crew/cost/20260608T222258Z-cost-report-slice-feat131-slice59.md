---
kind: cost-report
feature: FEAT-131
run_title: "FEAT131 SLICE59"
usd: 7.7252
duration_ms: 557516
total_tokens: 9195356
cache_hit_pct: 96.9
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-08T22:22:58.152Z
---

# Cost Report: FEAT131 SLICE59

- Created: 2026-06-08T22:22:58.152Z
- Run Title: FEAT131 SLICE59
- Window Start: 2026-06-08T22:13:40.241Z
- Window End: 2026-06-08T22:22:57.757Z
- Duration: 9.3 min (557516 ms)
- Sessions Scanned: 2
- Assistant Messages Counted: 92
- Total Tokens: 9,195,356
- Cache Hit %: 96.9%
- Total USD: $7.7252
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 145
- cache_create_5m: 0
- cache_create_1h: 287,278
- cache_read: 8,882,758
- output: 25,175

## Model Mix

- claude-sonnet-4-6 (priced as claude-sonnet-4): 74 msgs (80.43%), $4.0269 (52.13%)
- claude-opus-4-7 (priced as claude-opus-4): 18 msgs (19.57%), $3.6983 (47.87%)

## Conversation Shape

- user_msg_count: 1
- user_msg_avg_len: 194
- turns_before_first_tool: 0
- compaction_count: 4
- skill_invocations: 0
- subagent_dispatches: 2

## Tool Usage

- Bash: 31 (2 failed)
- TaskCreate: 7
- Read: 7
- Edit: 4
- Agent: 2
- TaskUpdate: 2
- ToolSearch: 1
- Write: 1 (1 failed)

## Tool Result Sizes (bytes)

- count: 56
- sum: 32,415
- p50: 158
- p90: 1,606
- max: 8,029

## File Re-reads

- redundant_read_count: 3
- top paths:
  - 2× C:\work\mega\hero-crew\scripts\lib\installer\util.ts
  - 2× C:\work\mega\hero-crew\scripts\lib\fs-utils.mjs
  - 2× C:\work\mega\hero-crew\scripts\validate-manifests.ts

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Agent: 2 calls, 2,230B results, ~243,670 cache_create tok (109.27×)
- Bash: 31 calls, 22,106B results, ~23,246 cache_create tok (1.05×)
- ToolSearch: 1 calls, 152B results, ~7,110 cache_create tok (46.78×)
- Read: 7 calls, 6,585B results, ~6,873 cache_create tok (1.04×)
- Edit: 4 calls, 656B results, ~1,277 cache_create tok (1.95×)
- TaskCreate: 7 calls, 417B results, ~1,143 cache_create tok (2.74×)
- Write: 1 calls, 96B results, ~780 cache_create tok (8.13×)
- TaskUpdate: 2 calls, 44B results, ~397 cache_create tok (9.02×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 18
- usd: $3.6983
- input: 65
- cache_create_5m: 0
- cache_create_1h: 25,595
- cache_read: 1,699,785
- output: 5,064

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 74
- usd: $4.0269
- input: 80
- cache_create_5m: 0
- cache_create_1h: 261,683
- cache_read: 7,182,973
- output: 20,111

