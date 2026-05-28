---
kind: cost-report
run_title: "Agent color badges added — v0.3.9 + retrospective pending"
usd: 1558.0376
duration_ms: 122403103
total_tokens: 816253710
cache_hit_pct: 98.3
source_project: aggregate
aggregate_all: true
source_count: 5
created_at: 2026-05-28T15:18:35.437Z
---

# Cost Report: Agent color badges added — v0.3.9 + retrospective pending

- Created: 2026-05-28T15:18:35.437Z
- Run Title: Agent color badges added — v0.3.9 + retrospective pending
- Window Start: 2026-05-27T05:18:30.830Z
- Window End: 2026-05-28T15:18:33.933Z
- Duration: 2040.1 min (122403103 ms)
- Sessions Scanned: 11
- Assistant Messages Counted: 3763
- Total Tokens: 816,253,710
- Cache Hit %: 98.3%
- Total USD: $1558.0376
- Source Project: aggregate
- Auto-detected: no
- Aggregate All: yes

## Sources (aggregated)

- C--work-mega-AstraGenie-MemoryService: 1715 msgs, $881.1671
- C--work-mega-hero-crew-autonomous-loop: 559 msgs, $285.0364
- C--work-mega-Astra-Humanizer: 940 msgs, $192.2612
- C--work-mega-Astra-LoopObserver: 436 msgs, $165.7456
- C--work-mega-hero-crew: 113 msgs, $33.8273

## Tokens (totals)

- input: 13,415
- cache_create_5m: 0
- cache_create_1h: 13,565,078
- cache_read: 799,799,380
- output: 2,875,837

## Model Mix

- claude-opus-4-7 (priced as claude-opus-4): 2638 msgs (70.1%), $1491.9119 (95.76%)
- claude-sonnet-4-6 (priced as claude-sonnet-4): 1125 msgs (29.9%), $66.1257 (4.24%)

## Conversation Shape

- user_msg_count: 167
- user_msg_avg_len: 653
- turns_before_first_tool: 0
- compaction_count: 80
- skill_invocations: 27
- subagent_dispatches: 75

## Tool Usage

- Bash: 880 (48 failed)
- Read: 403 (4 failed)
- Edit: 237 (26 failed)
- Write: 222 (5 failed)
- Grep: 91 (1 failed)
- TaskUpdate: 76
- Agent: 75 (5 failed)
- PowerShell: 72 (8 failed)
- Glob: 58
- TaskCreate: 56
- AskUserQuestion: 50 (4 failed)
- Skill: 27
- ToolSearch: 22
- ScheduleWakeup: 13
- TaskStop: 5
- mcp__plugin_playwright_playwright__browser_navigate: 3
- mcp__plugin_playwright_playwright__browser_console_messages: 3
- mcp__plugin_playwright_playwright__browser_network_requests: 3
- mcp__plugin_microsoft-docs_microsoft-learn__microsoft_code_sample_search: 3
- mcp__plugin_playwright_playwright__browser_snapshot: 2
- mcp__plugin_microsoft-docs_microsoft-learn__microsoft_docs_search: 2
- TaskList: 1
- PushNotification: 1

## Tool Result Sizes (bytes)

- count: 2312
- sum: 3,611,844
- p50: 216
- p90: 2,231
- max: 191,868

## File Re-reads

- redundant_read_count: 124
- top paths:
  - 9× C:\work\mega\AstraGenie.MemoryService\src\frontend\memory-dashboard\src\App.tsx
  - 8× C:\work\mega\Astra.Humanizer\.claude\artifacts\loop\ai-loop\backlog\approved-slices.md
  - 8× C:\work\mega\AstraGenie.MemoryService\src\MemoryService.Infrastructure\ServiceCollectionExtensions.cs
  - 7× C:\work\mega\AstraGenie.MemoryService\src\MemoryService.Api\Controllers\MemoriesController.cs
  - 7× C:\work\mega\AstraGenie.MemoryService\src\frontend\memory-dashboard\src\pages\MemoryExplorerPage.tsx

## Cache Priming (per tool, approximate)

Attribution: each tool's tool_result size weighted against the NEXT assistant turn's cache_create tokens. Numbers are directional, not precise — system-prompt drift and prior-turn re-injection inflate ratios.

- Bash: 884 calls, 801,974B results, ~3,048,526 cache_create tok (3.8×)
- TaskCreate: 56 calls, 4,198B results, ~2,423,347 cache_create tok (577.26×)
- Read: 405 calls, 2,314,191B results, ~2,058,037 cache_create tok (0.89×)
- Write: 222 calls, 42,208B results, ~1,125,377 cache_create tok (26.66×)
- ToolSearch: 22 calls, 3,577B results, ~1,124,349 cache_create tok (314.33×)
- AskUserQuestion: 50 calls, 11,006B results, ~1,045,742 cache_create tok (95.02×)
- Agent: 74 calls, 178,861B results, ~969,411 cache_create tok (5.42×)
- Skill: 27 calls, 1,059B results, ~382,733 cache_create tok (361.41×)
- Glob: 58 calls, 47,996B results, ~339,546 cache_create tok (7.07×)
- Edit: 237 calls, 43,446B results, ~332,064 cache_create tok (7.64×)
- TaskUpdate: 76 calls, 1,715B results, ~266,130 cache_create tok (155.18×)
- PowerShell: 72 calls, 34,758B results, ~199,867 cache_create tok (5.75×)
- Grep: 91 calls, 52,683B results, ~82,309 cache_create tok (1.56×)
- mcp__plugin_microsoft-docs_microsoft-learn__microsoft_code_sample_search: 3 calls, 22,527B results, ~58,260 cache_create tok (2.59×)
- mcp__plugin_microsoft-docs_microsoft-learn__microsoft_docs_search: 2 calls, 36,962B results, ~31,898 cache_create tok (0.86×)
- PushNotification: 1 calls, 75B results, ~26,830 cache_create tok (357.73×)
- TaskStop: 5 calls, 2,565B results, ~23,384 cache_create tok (9.12×)
- ScheduleWakeup: 13 calls, 2,034B results, ~14,877 cache_create tok (7.31×)
- mcp__plugin_playwright_playwright__browser_snapshot: 2 calls, 2,836B results, ~6,600 cache_create tok (2.33×)
- mcp__plugin_playwright_playwright__browser_network_requests: 3 calls, 890B results, ~1,574 cache_create tok (1.77×)
- mcp__plugin_playwright_playwright__browser_navigate: 3 calls, 984B results, ~1,396 cache_create tok (1.42×)
- mcp__plugin_playwright_playwright__browser_console_messages: 3 calls, 845B results, ~1,396 cache_create tok (1.65×)
- TaskList: 1 calls, 14B results, ~922 cache_create tok (65.86×)


## By Model (token detail)

### claude-sonnet-4-6 (priced as claude-sonnet-4)
- messages: 1125
- usd: $66.1257
- input: 1,408
- cache_create_5m: 0
- cache_create_1h: 3,919,647
- cache_read: 107,573,507
- output: 688,770

### claude-opus-4-7 (priced as claude-opus-4)
- messages: 2638
- usd: $1491.9119
- input: 12,007
- cache_create_5m: 0
- cache_create_1h: 9,645,431
- cache_read: 692,225,873
- output: 2,187,067

