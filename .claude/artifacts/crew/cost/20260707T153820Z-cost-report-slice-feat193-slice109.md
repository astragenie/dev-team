---
kind: cost-report
feature: FEAT-193
run_title: "FEAT193 SLICE109"
usd: 255.3495
duration_ms: 9190362
total_tokens: 132944158
cache_hit_pct: 99.2
source_project: C--work-mega-dev-team
aggregate_all: false
source_count: 1
created_at: 2026-07-07T15:38:20.140Z
---

# Cost Report: FEAT193 SLICE109

- Created: 2026-07-07T15:38:20.140Z
- Run Title: FEAT193 SLICE109
- Window Start: 2026-07-07T13:05:09.361Z
- Window End: 2026-07-07T15:38:19.723Z
- Duration: 153.2 min (9190362 ms)
- Sessions Scanned: 1
- Assistant Messages Counted: 406
- Total Tokens: 132,944,158
- Cache Hit %: 99.2%
- Total USD: $255.3495
- Source Project: C--work-mega-dev-team
- Auto-detected: no
- Aggregate All: no

## Tokens (totals)

- input: 238,534
- cache_create_5m: 0
- cache_create_1h: 860,658
- cache_read: 131,461,506
- output: 383,460

## Model Mix

- claude-opus-4-8 (priced as claude-opus-4): 406 msgs (100%), $255.3495 (100%)

## Conversation Shape

- user_msg_count: 10
- user_msg_avg_len: 2242
- turns_before_first_tool: 2
- compaction_count: 3
- skill_invocations: 1
- subagent_dispatches: 2

## Tool Usage

- Bash: 94 (1 failed)
- Edit: 43
- Read: 13
- Write: 7
- Grep: 3
- Agent: 2
- SendMessage: 2
- ToolSearch: 1
- Skill: 1

## Tool Result Sizes (bytes)

- count: 167
- sum: 142,018
- p50: 163
- p90: 2,246
- max: 21,330

## File Re-reads

- redundant_read_count: 3
- top paths:
  - 2× C:/work/mega/dev-team/scripts/crew.ts
  - 2× C:/work/mega/dev-team/scripts/validate-agents.ts
  - 2× C:\work\mega\dev-team\scripts\crew.ts

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 94 calls, 54,336B results, ~410,595 cache_create tok (7.56×)
- Read: 13 calls, 66,459B results, ~162,563 cache_create tok (2.45×)
- Grep: 3 calls, 6,212B results, ~143,420 cache_create tok (23.09×)
- Edit: 43 calls, 6,537B results, ~68,748 cache_create tok (10.52×)
- Write: 7 calls, 1,059B results, ~51,822 cache_create tok (48.93×)
- Agent: 2 calls, 3,297B results, ~13,131 cache_create tok (3.98×)
- SendMessage: 2 calls, 834B results, ~4,114 cache_create tok (4.93×)
- ToolSearch: 1 calls, 53B results, ~1,504 cache_create tok (28.38×)
- Skill: 1 calls, 29B results, ~0 cache_create tok (0×)


## By Model (token detail)

### claude-opus-4-8 (priced as claude-opus-4)
- messages: 406
- usd: $255.3495
- input: 238,534
- cache_create_5m: 0
- cache_create_1h: 860,658
- cache_read: 131,461,506
- output: 383,460

