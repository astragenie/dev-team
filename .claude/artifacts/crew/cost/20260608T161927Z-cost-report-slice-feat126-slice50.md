---
kind: cost-report
feature: FEAT-126
run_title: "FEAT126 SLICE50"
usd: 75.6305
duration_ms: 42417814
total_tokens: 65502809
cache_hit_pct: 97.7
source_project: C--work-mega-hero-crew
aggregate_all: false
source_count: 1
created_at: 2026-06-08T16:19:27.126Z
---

# Cost Report: FEAT126 SLICE50

- Created: 2026-06-08T16:19:27.126Z
- Run Title: FEAT126 SLICE50
- Window Start: 2026-06-08T04:32:28.948Z
- Window End: 2026-06-08T16:19:26.762Z
- Duration: 707.0 min (42417814 ms)
- Sessions Scanned: 2
- Assistant Messages Counted: 447
- Total Tokens: 65,502,809
- Cache Hit %: 97.7%
- Total USD: $75.6305
- Source Project: C--work-mega-hero-crew
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 804
- cache_create_5m: 0
- cache_create_1h: 1,470,254
- cache_read: 63,835,755
- output: 195,996

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 126 msgs (28.19%), $55.8948 (73.91%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 321 msgs (71.81%), $19.7356 (26.09%)

## Conversation Shape

- user_msg_count: 37
- user_msg_avg_len: 569
- turns_before_first_tool: 0
- compaction_count: 15
- skill_invocations: 5
- subagent_dispatches: 13

## Tool Usage

- Bash: 129 (6 failed)
- Read: 37
- Edit: 31 (3 failed)
- Grep: 22
- TaskUpdate: 15
- Agent: 13
- Write: 6
- Glob: 6
- Skill: 5
- TaskCreate: 5
- ToolSearch: 2

## Tool Result Sizes (bytes)

- count: 272
- sum: 316,502
- p50: 218
- p90: 2,269
- max: 59,787

## File Re-reads

- redundant_read_count: 8
- top paths:
  - 4× C:\work\mega\hero-crew\agents\builder-be.md
  - 3× C:\work\mega\hero-crew\CHANGELOG.md
  - 2× C:\work\mega\hero-crew\docs\routing-table.md
  - 2× C:\work\mega\hero-crew\.claude\artifacts\loop\backlog\in-progress\FEAT-126.md
  - 2× C:\Users\serge\.claude\projects\C--work-mega-hero-crew\27217f2c-6a52-4a48-a974-b6b3c8e0239f\tool-results\bgef8c48a.txt

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 129 calls, 98,833B results, ~721,209 cache_create tok (7.3×)
- Read: 37 calls, 163,687B results, ~325,847 cache_create tok (1.99×)
- Grep: 22 calls, 14,440B results, ~181,428 cache_create tok (12.56×)
- Agent: 13 calls, 27,891B results, ~148,026 cache_create tok (5.31×)
- Skill: 5 calls, 255B results, ~33,721 cache_create tok (132.24×)
- Write: 6 calls, 1,128B results, ~25,001 cache_create tok (22.16×)
- Edit: 31 calls, 4,634B results, ~17,962 cache_create tok (3.88×)
- ToolSearch: 2 calls, 155B results, ~7,632 cache_create tok (49.24×)
- TaskUpdate: 15 calls, 330B results, ~4,396 cache_create tok (13.32×)
- Glob: 6 calls, 3,593B results, ~3,325 cache_create tok (0.93×)
- TaskCreate: 5 calls, 435B results, ~968 cache_create tok (2.23×)


## By Model (token detail)

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 126
- usd: $55.8948
- input: 174
- cache_create_5m: 0
- cache_create_1h: 249,534
- cache_read: 29,660,459
- output: 52,207

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 321
- usd: $19.7356
- input: 630
- cache_create_5m: 0
- cache_create_1h: 1,220,720
- cache_read: 34,175,296
- output: 143,789

