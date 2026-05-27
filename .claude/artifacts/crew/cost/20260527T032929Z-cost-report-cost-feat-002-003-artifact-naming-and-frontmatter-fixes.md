---
kind: cost-report
run_title: "FEAT-002+003 artifact naming and frontmatter fixes"
usd: 11.0751
duration_ms: 241286
total_tokens: 6365981
cache_hit_pct: 96.3
source_project: aggregate
aggregate_all: true
source_count: 4
created_at: 2026-05-27T03:29:29.312Z
---

# Cost Report: Cost — FEAT-002+003 artifact naming and frontmatter fixes

- Created: 2026-05-27T03:29:29.312Z
- Run Title: FEAT-002+003 artifact naming and frontmatter fixes
- Window Start: 2026-05-27T03:25:27.122Z
- Window End: 2026-05-27T03:29:28.408Z
- Duration: 4.0 min (241286 ms)
- Sessions Scanned: 5
- Assistant Messages Counted: 82
- Total Tokens: 6,365,981
- Cache Hit %: 96.3%
- Total USD: $11.0751
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-hero-crew-autonomous-loop: 26 msgs, $7.0323
- C--work-mega-hero-crew: 10 msgs, $2.2171
- C--work-mega-Astra-Humanizer: 35 msgs, $1.2939
- C--work-mega-Astra-LoopObserver: 11 msgs, $0.5317

## Tokens (totals)

- input: 102
- cache_create_5m: 0
- cache_create_1h: 236,720
- cache_read: 6,100,850
- output: 28,309

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 36 msgs (43.9%), $9.2494 (83.52%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 46 msgs (56.1%), $1.8256 (16.48%)

## Conversation Shape

- user_msg_count: 5
- user_msg_avg_len: 3409
- turns_before_first_tool: 1
- compaction_count: 4
- skill_invocations: 2
- subagent_dispatches: 2

## Tool Usage

- Bash: 22
- Write: 11
- Read: 10
- Edit: 4
- Skill: 2
- Agent: 2

## Tool Result Sizes (bytes)

- count: 51
- sum: 105,546
- p50: 241
- p90: 4,706
- max: 19,738

## File Re-reads

- redundant_read_count: 3
- top paths:
  - 4× C:\Users\serge\.claude\projects\C--work-mega-hero-crew-autonomous-loop\59bf677d-0c18-4739-8e63-1ed17511e584\tool-results\bxg4rt2cy.txt

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 22 calls, 27,079B results, ~94,892 cache_create tok (3.5×)
- Read: 10 calls, 70,713B results, ~47,189 cache_create tok (0.67×)
- Agent: 1 calls, 4,706B results, ~7,137 cache_create tok (1.52×)
- Edit: 4 calls, 789B results, ~5,997 cache_create tok (7.6×)
- Write: 11 calls, 1,943B results, ~5,171 cache_create tok (2.66×)
- Skill: 2 calls, 61B results, ~2,916 cache_create tok (47.8×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 46
- usd: $1.8256
- input: 54
- cache_create_5m: 0
- cache_create_1h: 98,937
- cache_read: 3,353,541
- output: 15,052

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 36
- usd: $9.2494
- input: 48
- cache_create_5m: 0
- cache_create_1h: 137,783
- cache_read: 2,747,309
- output: 13,257

