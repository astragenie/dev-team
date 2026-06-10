---
kind: cost-report
run_title: "FEAT-148 builder scoped self-verify"
usd: 25.2677
duration_ms: 247391
total_tokens: 13696463
cache_hit_pct: 99.5
source_project: aggregate
aggregate_all: true
source_count: 2
created_at: 2026-06-10T20:00:00.622Z
---

# Cost Report: FEAT-148 builder scoped self-verify

- Created: 2026-06-10T20:00:00.622Z
- Run Title: FEAT-148 builder scoped self-verify
- Window Start: 2026-06-10T19:55:45.231Z
- Window End: 2026-06-10T19:59:52.622Z
- Duration: 4.1 min (247391 ms)
- Sessions Scanned: 2
- Assistant Messages Counted: 38
- Total Tokens: 13,696,463
- Cache Hit %: 99.5%
- Total USD: $25.2677
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-hero-crew: 30 msgs, $20.0208
- C--work-mega-loop: 8 msgs, $5.2469

## Tokens (totals)

- input: 12,382
- cache_create_5m: 0
- cache_create_1h: 61,907
- cache_read: 13,584,195
- output: 37,979

## Model Mix

- claude-opus-4-8 (priced as claude-opus-4): 38 msgs (100%), $25.2677 (100%)

## Conversation Shape

- user_msg_count: 2
- user_msg_avg_len: 17
- turns_before_first_tool: 2
- compaction_count: 1
- skill_invocations: 1
- subagent_dispatches: 1

## Tool Usage

- Bash: 6
- Read: 3
- Edit: 3
- Skill: 1
- Agent: 1

## Tool Result Sizes (bytes)

- count: 13
- sum: 14,788
- p50: 729
- p90: 1,880
- max: 5,335

## File Re-reads

- redundant_read_count: 0

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 5 calls, 8,085B results, ~28,463 cache_create tok (3.52×)
- Read: 3 calls, 4,351B results, ~10,803 cache_create tok (2.48×)
- Edit: 3 calls, 444B results, ~6,306 cache_create tok (14.2×)
- Skill: 1 calls, 28B results, ~2,427 cache_create tok (86.68×)


## By Model (token detail)

### claude-opus-4-8 (priced as claude-opus-4)
- messages: 38
- usd: $25.2677
- input: 12,382
- cache_create_5m: 0
- cache_create_1h: 61,907
- cache_read: 13,584,195
- output: 37,979

