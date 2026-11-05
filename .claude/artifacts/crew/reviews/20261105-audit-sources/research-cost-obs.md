# Research: agent cost control + observability (as of 2026-11-05)
Verified = fetched directly. Search-snippet-only = UNVERIFIED.

## Verified facts
- Claude Code OTel reference: https://code.claude.com/docs/en/monitoring-usage
  - Metrics claude_code.cost.usage / token.usage, attrs: model, query_source (main|subagent|auxiliary), speed, effort, agent.name, skill.name, plugin.name, mcp_server.name. Events: api_request (cost_usd, cost_usd_micros, cache_read_tokens, cache_creation_tokens, cache_creation_5m/1h_tokens from v2.1.300), subagent_completed (agent_type, total_tokens, total_tool_uses, duration_ms, model, model_swapped), tool_result, safety_event. agent_id / parent_agent_id (v2.1.310+), workflow.run_id, prompt.id (events only).
  - Traces (beta): claude_code.interaction > llm_request / tool > subagent spans. Needs CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1. TRACEPARENT propagated to Bash subprocesses.
  - cost_usd is an ESTIMATE, not billing. token.usage cacheCreation merges 5m and 1h writes. `input` excludes cache tokens.
  - TRAP: subagent_completed.total_tokens is the final API request footprint only, NOT a run sum. Summing it as spend is wrong.
  - Repo .claude/settings.json cannot enable telemetry or set its destination. OTEL_* vars are stripped from hook subprocesses (reported in issue 85422 thread).
- Hooks reference: https://code.claude.com/docs/en/hooks (page truncated at 100k chars)
  - Command hooks accept async:true (no timeout enforced, onFailure ignored); asyncRewake wakes Claude on exit 2. type:http hooks POST JSON (url, headers, allowedEnvVars, timeout). Matching hooks for one event run in parallel. Default timeout 600s (30s UserPromptSubmit). SessionEnd shares a 1.5s budget.
  - Common input: session_id, prompt_id, transcript_path, effort; subagent: agent_id, agent_type. No token fields seen on SubagentStop in the visible part.
- Pricing: https://platform.claude.com/docs/en/about-claude/pricing (per MTok: input / 5m write / 1h write / cache read / output)
  - Fable 5.1: 10 / 12.5 / 20 / 0.25 / 50
  - Opus 5.5: 4 / 5 / 8 / 0.20 / 20 (fast mode 8 / 40, stacks with cache multipliers, no Batch)
  - Sonnet 5.5: 2 / 2.5 / 4 / 0.10 / 10
  - Haiku 5.5 (<=100K prompt): 0.10 / 0.125 / 0.20 / 0.01 / 0.50; over 100K: 0.50 / 0.625 / 1 / 0.05 / 2.50
  - Batch is 50% off. 1h write = 2x input, 5m write = 1.25x. Cache read rates changed vs prior gen (Opus 5 0.50 -> Opus 5.5 0.20; Fable 5 1.00 -> Fable 5.1 0.25), so stale price tables misprice.
- Subagent cache economics: https://github.com/anthropics/claude-code/issues/74318 (open, no maintainer reply; one user's transcripts, list-price modeled)
  - Subagents use 5m TTL; parent cache expires while blocked on a child (median idle ~9 min). Cold-start subagent ~37k tokens, ~3% task-specific. Blanket 1h TTL for subagents is worse (+8.6%). Reordering per-invocation content (date, cwd, branch, task) AFTER the shared static prefix: -7.6%. All three proposed fixes: -13.6% subagent prompt cost (~8% total spend). Sep 29 comment: CLAUDE.md, skill listing, deferred MCP list re-written per sibling (~18% of weekly tokens on fan-out workflows).
- Budget caps: https://github.com/anthropics/claude-code/issues/85422 (open). Maintainer, Aug 17: `claude -p --max-budget-usd N` is a hard cap that also stops background subagents. No interactive equivalent, no per-source attribution, no rolling window. Community: per-subagent caps miss fan-out, so aggregate over the spawn tree; missing data must not read as zero; raw tokens do not equal spend because of cache rates.
- Hook budget guard: https://github.com/hahahahahahahahah6/subagent-budget (PreToolUse on Task, exit 2 blocks; ledger.jsonl; stdlib Python; sync estimate defaults to 47,117 tokens per Task, i.e. rough; community project, unaudited).
- OTel GenAI semconv: https://github.com/open-telemetry/semantic-conventions-genai/blob/main/docs/gen-ai/gen-ai-agent-spans.md. Status Development, not stable; moved to a dedicated repo June 2026. Ops: create_agent, invoke_agent, invoke_workflow, plan, execute_tool. Attrs: gen_ai.agent.{id,name,version}, gen_ai.usage.input_tokens (includes cached), gen_ai.usage.cache_read.input_tokens, cache_write.input_tokens. Stability date UNVERIFIED (none found).
- Langfuse v4: https://langfuse.com/changelog/2026-08-17-langfuse-v4 (from search summary, not fetched): Monitors (cost/quality/latency alerts), Pulse. Cloud v4-only on 2026-11-16. Agent graphs "in progress" on a preview roadmap page: UNVERIFIED.
- ccusage: https://github.com/ryoppippi/ccusage. Daily/weekly/monthly/session/5h-block reports, statusline (beta), --json, --by-agent (semantics undocumented), LiteLLM price file. Offline, transcript-based, same estimate caveat.
- Sonnet vs Opus 5.5: https://the-decoder.com/anthropics-claude-sonnet-5-5-nearly-matches-opus-5-5-on-benchmarks-while-costing-up-to-30-percent-less-per-task/ (Anthropic-reported). Terminal-Bench 4.0: Sonnet 70.6 vs Opus 66.4. CursorBench 4.0: 55.5 vs 57.8. FrontierCode: 52.1 (xhigh) vs 54.4. "Up to 30% fewer tokens per task" claimed, unconfirmed. Sonnet at Max effort scored lower than xhigh because it triggers a code-review fan-out to subagents (timeouts, out-of-scope edits). No published data on review or validation roles. SWE-bench Pro 89.9 vs 81.3 from aggregators: UNVERIFIED.

## UNVERIFIED / not found
- Routers (RouteLLM, Not Diamond, OpenRouter auto): vendor/aggregator claims (~30% savings). One Jan 2026 arXiv benchmark (2601.07206) reportedly finds routers do not beat best-single-model. A static role-to-model table fits crew better.
- Helicone, Portkey, LiteLLM budgets, Braintrust, Phoenix, AgentOps, OpenLLMetry, Anthropic Admin/Usage API: no verified source fetched. LiteLLM budgets only apply if crew routes through a proxy.

## Ranked adoption for crew
1. Fix cost accounting first (S). For the $2433/iteration figure, check whether code sums subagent_completed.total_tokens or hook usage (final-request footprints, not run sums), applies one rate to cacheCreation (5m 1.25x vs 1h 2x), or uses stale price rows. Use api_request cost_usd_micros or token.usage grouped by agent_id, or transcript usage including <session>/subagents/agent-*.jsonl (nested files held ~45% of records in one report). Add a unit test with a known transcript. This is a hypothesis; crew code was not inspected.
2. Prompt-prefix hygiene in dispatch templates (S-M). Stable agent prompt and shared rules first; date, cwd, branch, task last; short briefs, no re-pasted parent context. Do not blanket-force 1h TTL.
3. Budget circuit breaker (M). PreToolUse on Agent/Task keeps a spawn-tree ledger per run keyed by agent_id/parent_agent_id, blocks with exit 2 at cap, treats unknown as unknown, also caps spawn count and depth. For unattended loop runs add `claude -p --max-budget-usd` as the outer hard cap (the only official enforcement).
4. Cheaper telemetry hooks (S). Mark otel-* hooks async:true, or use one dispatcher per event appending JSONL and exporting batched at Stop/SessionEnd (1.5s budget). Hooks already run in parallel per event, so the cost of three hooks is process spawn, not serial latency. Prefer native OTel (agent_id, subagent_completed, traces beta) over re-deriving, noting repo settings cannot enable it.
5. Align exporter with OTel GenAI names (S). Emit gen_ai.agent.name, gen_ai.usage.* incl. cache read/write, invoke_agent span names, behind a mapping layer because the spec is Development. Add Langfuse v4 Monitors for cost thresholds before the 2026-11-16 Cloud cutover.
Also: refresh price table (rows above); keep architect:opus, build:sonnet; avoid Sonnet at max effort with review fan-out.
