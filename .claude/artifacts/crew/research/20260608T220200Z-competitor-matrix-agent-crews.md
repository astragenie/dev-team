# Competitor matrix — agent-crew frameworks

**Date:** 2026-06-08
**Author:** researcher (read-only)
**Scope:** Multi-agent / crew / team frameworks that compete with this repo's Crew harness (Claude Code plugin v0.14.1 — lead-guided workflow, bounded subagents, quality gates, artifact-based memory).
**Baseline files:** `README.md`, `docs/architecture/architecture.md`, `docs/routing-table.md`, `CHANGELOG.md`, `CLAUDE.md`.

---

## 1. TL;DR

- **Crew leads on:** gate composition (review -> validation -> deploy evidence as separate enforceable artifacts) + routing-table-as-source-of-truth (one place to rename a skill across all agents) + artifact-based durable memory (`.claude/artifacts/crew/` committed alongside code). No other surveyed framework treats reviewer / validator / deployer as *first-class roles with separate evidence types*.
- **Crew leads on:** lead-routed bounded subagents with structured handoffs (`write-handoff` CLI returns a path + headline, body never re-inflates lead context). Most competitors hand off via shared message bus or full-state passing; few treat context budget as a per-agent contract.
- **Crew lags on:** durable graph execution / checkpointing. LangGraph 1.2, Pydantic AI, CrewAI, and MAF all ship "agent run is a resumable graph, persists through process restart" — Crew relies on `workflow-state.json` + manual artifact replay, which loses live tool state on crash.
- **Crew lags on:** built-in observability (tracing, evals, perf benchmarks). OpenAI Agents SDK, Pydantic AI Evals, MAF telemetry, LangSmith all ship turnkey trace UIs. Crew has cost reports + grade files but no streaming trace UI or eval harness.
- **Biggest gap:** **no cross-framework portability story**. The Anthropic agent-skills.io standard is emerging (portable across Claude Code / Cursor / Codex / Gemini CLI / 30+ agents per netresearch/claude-code-marketplace). Crew is Claude-Code-only by design; competitors that adopt the open agent-skills standard get reach Crew cannot match without an explicit portability decision.

---

## 2. Feature matrix

Legend: YES = first-class · PART = partial / via convention · NO = absent / not designed in · ? = unable to verify from public docs.

| Framework | Role model | Orchestration pattern | Memory model | Quality gates (review/val/deploy evidence) | Handoff format | Tool/skill discovery | Cost telemetry | HITL hooks | Cross-session persistence | License | Host runtime | Multi-model |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| **Crew (this repo)** | Fixed (lead, builder, reviewer, validator, deployer, researcher + 6 specialists) | Lead-guided hub-and-spoke + skill routing table | Artifact files + repo-CLAUDE.md + workflow-state.json | YES review + validation + deployment as separate artifacts | YES structured handoff CLI returns path + headline | Routing table heuristic + lead judgment | YES per-slice cost reports + cost-advisor | YES escalated_to_human badge + production-promotion explicit approval | YES committed artifacts | MIT | Claude Code plugin only | Single-vendor (Anthropic) |
| **CrewAI** | Free-form (role + goal + backstory) | Sequential / hierarchical / consensual + Flows event-driven | In-process + optional vector + checkpointing | NO no review/validation/deploy gate primitives | Message passing through tasks + Flow state | Tool annotation on agent; MCP-native | PART token telemetry per agent | PART human-input tool | YES checkpoints (fork / replay) | MIT | Python SDK + CrewAI Enterprise hosted | YES any LLM |
| **AutoGen (maintenance)** | Free-form (UserProxyAgent / AssistantAgent + specialized) | Conversation-based async event-driven | Conversation history is the state | NO critic agent is convention, not enforced gate | Natural-language messages between agents | Tool registration in agent ctor | NO none first-class | YES UserProxyAgent | PART conversation transcript persistence | CC-BY 4.0 / MIT | Python SDK | YES any LLM |
| **Microsoft Agent Framework (MAF)** | Free-form (composable agents) | Graph workflows + agent-to-agent structured messaging + CodeAct | Session-based durable state + telemetry | PART governance + observability primitives, not review/validate/deploy split | Structured messages (new cross-framework protocol) | Built-in tools + MCP + Semantic Kernel plugins | YES OpenTelemetry-native | YES hosted agents + harness controls | YES durable state for long-running agents | MIT | Python + .NET SDK + Azure hosted | YES (Azure / OpenAI / Anthropic / open) |
| **LangGraph 1.2** | Free-form (any callable as node) | Stateful directed graph (branches, loops, retries, checkpoints) | Persistent checkpointer (Postgres / SQLite / in-mem) + short/long-term memory | NO reviewer / validator are user-built nodes | Shared graph state object | Tool binding on node | PART via LangSmith | YES interrupt nodes + state edit | YES durable graph execution | MIT | Python / TS SDK + LangGraph Platform | YES any LLM |
| **OpenAI Agents SDK** (Swarm successor) | Free-form (agent = instructions + tools) | Lightweight handoffs between agents | Sessions API + in-process | PART guardrails (input/output validation), no separate review artifact | YES handoff primitive (explicit control transfer w/ context) | Tool decorator on agent | PART built-in tracing UI; no $ telemetry first-class | PART guardrails + human review pattern | PART sessions (server-side) | MIT | Python + TS SDK | Single-vendor (OpenAI; LiteLLM for others) |
| **Anthropic Claude Agent SDK** | Free-form (one agent + subagents + skills) | Single agent loop + session forking + skills | Auto-compaction + CLAUDE.md re-read + sessions | NO no review/validate/deploy gates (you build them) | Session forks / message returns | Built-in tools (14+) + Agent Skills + MCP | PART token usage telemetry | YES fine-grained tool permissions | YES sessions | MIT (SDK) | Python + TS SDK | Single-vendor (Anthropic) |
| **Cursor agent mode** | Fixed (single agent w/ background variants) | Background agents on cloud VMs + git-worktree parallel | Project context auto-indexed | NO internal; no inspectable handoffs | Internal (closed) | Closed | NO subscription-based | PART approval before run | PART conversation history | Proprietary | IDE | YES (Anthropic / OpenAI / others) |
| **Cline** | Fixed (single agent, Plan / Act modes) | Plan-then-act with per-step approval | Conversation history + VS Code workspace | PART approval at every tool use = light gate | NO no agent-to-agent | Tool list per mode | NO user pays LLM | YES every step requires approval | PART conversation only | Apache 2.0 | VS Code extension | YES any LLM |
| **Roo Code** | Fixed modes (Code / Architect / Ask / Debug / + custom personalities) | Mode-switching single-agent + persona overlays | Same as Cline + persona memory | PART mode-as-gate (e.g. Architect plans before Code) | Mode handoff via user toggle | Per-mode tool set | NO user pays LLM | YES per-step approval | PART conversation only | Apache 2.0 | VS Code extension | YES any LLM |
| **MetaGPT** | Fixed (PM / Architect / PM-2 / Engineer / QA) | SOP-encoded sequential assembly line + shared message pool | Shared message pool + structured artifacts per role | PART QA role is a built-in review/test step; not separate deploy gate | YES structured artifact per role | Tool registration on role | NO not first-class | PART human-in-loop role | PART workspace artifacts | MIT | Python SDK | YES any LLM |
| **AutoGPT (legacy)** | Single autonomous agent | Self-prompted task decomposition loop | Local file + optional vector | NO none | NO self-talk only | Plugin system | NO not first-class | NO goal-driven autonomy | PART workspace folder | MIT | CLI + hosted (AutoGPT Platform) | YES any LLM |
| **Devin (Cognition)** | Single coding agent (cloud sandbox) | Cloud VM + own IDE/browser/terminal + Interactive Planning | Devin Wiki auto-indexes repo | PART approves plan before exec; PR review by GH | Submits PR (artifact = PR) | Internal | NO ACU billing only | YES plan approval | YES PR + Wiki | Proprietary | Hosted | Single-vendor |
| **SWE-agent** | Single coding agent (Princeton/Stanford) | Agent-computer interface + shell loop | Workspace + scratchpad | NO research-focused, no gates | NO single agent | Shell + edit + search | NO | NO | PART workspace | MIT | Python CLI | YES any LLM |
| **Aider** | Single pair-programmer | REPL + git commit per change | Repo-map + chat history | PART git history = audit trail; no review role | NO single agent | Built-in (edit, run, lint) | PART token counter | YES confirm-before-commit | YES git is the memory | Apache 2.0 | Python CLI | YES any LLM |
| **OpenHands** (OpenDevin) | Free-form (CodeAct + delegation) | CodeAct loop (plan -> shell -> test -> iterate) | Workspace + event stream | PART test-suite-as-gate baked into loop | YES delegation between agent types | Python tool defs + MCP | PART per-run via cloud | PART pause / resume | YES event stream | MIT | Python SDK + cloud | YES any LLM |
| **Smolagents (HF)** | Free-form (CodeAgent / ToolCallingAgent) | Code-as-action loop (~1k LoC) | In-process | NO none | NO single agent (multi via mgr pattern) | Tools as Python fns + Hub Space tools + LangChain tools + MCP | NO not first-class | NO | NO | Apache 2.0 | Python SDK | YES any LLM (LiteLLM) |
| **Pydantic AI** | Free-form (Agent + typed deps/output) | Tool calling + Graph + Durable Execution | Durable agent state + AI Gateway sessions | PART Pydantic Evals + structured output validation | PART deferred tools + HITL | Typed Tool decorator + MCP + toolsets | PART via AI Gateway | YES deferred/HITL tools first-class | YES durable execution | MIT | Python SDK | YES any LLM |
| **Mastra** | Free-form (supervisor + sub-agents) | Supervisor delegation + workflows | Observational memory (Observer + Reflector compress history) | PART eval primitives, no formal review role | Supervisor -> sub-agent calls | Tool decorator + MCP | PART via Mastra Cloud | PART workflow pauses | YES observational memory (SOTA on LongMemEval) | MIT (Elastic 2.0 for Cloud) | TS SDK + Mastra Cloud | YES 3,300+ models / 94 providers |

---
## 3. Per-competitor profile

### CrewAI
- **Does well:** Role/goal/backstory free-form authoring; rich orchestration choices (sequential, hierarchical, consensual, Flows event-driven); MCP-native tooling; checkpointing with fork/replay; commercial Enterprise SaaS for ops.
- **Crew beats it on:** Separate review/validation/deployment gate artifacts (CrewAI has no gate primitives — critic is a convention you must hand-build); routing-table-as-single-source-of-truth across agents; committed artifact memory under `.claude/artifacts/crew/`.
- **Beats Crew on:** Resumable checkpointed graph execution (fork + replay any task), bigger ecosystem of pre-built agents/tools, hosted Enterprise tier.
- **Stealable:** Fork-and-replay checkpoint primitive on top of `workflow-state.json` — let lead branch a slice mid-run and try two strategies.

### AutoGen (Microsoft, maintenance mode)
- **Does well:** Conversation-as-orchestration model; UserProxyAgent makes HITL trivial; large research codebase; helped invent the multi-agent space.
- **Crew beats it on:** Enforced gates; structured handoffs vs free-text messages; cost telemetry; explicit context-budget discipline; AutoGen is now superseded by MAF — strategic risk for adopters.
- **Beats Crew on:** Pure free-form conversational multi-agent flexibility; deeper research-lineage (CodeAct, society-of-mind).
- **Stealable:** UserProxyAgent pattern — a first-class `human` participant role beyond `escalated_to_human` badge.

### Microsoft Agent Framework (MAF, 1.0 GA 2026-04-02)
- **Does well:** AutoGen + Semantic Kernel converged into one supported platform; OpenTelemetry-native; CodeAct (model writes one Python program that calls `call_tool` repeatedly in a sandbox — collapses tool-call loop); Durable Task Scheduler for cross-machine workflow execution; .NET + Python parity.
- **Crew beats it on:** Roles-as-gates separation (MAF has governance/observability primitives but no review/validate/deploy artifact split); zero-overhead Claude Code integration; lighter footprint.
- **Beats Crew on:** Durable cross-machine execution; telemetry; CodeAct loop-collapsing; multi-language SDK.
- **Stealable:** CodeAct pattern — let the builder emit a single shell/TS script that batches tool calls instead of round-tripping per tool. Cost win when Crew already pays compaction tax.

### LangGraph 1.2
- **Does well:** Stateful directed graph with branches/loops/retries; pluggable checkpointer (Postgres / SQLite / in-mem); interrupt nodes for HITL state edit; LangSmith trace UI.
- **Crew beats it on:** Opinionated gate roles (LangGraph is a primitive kit — reviewer/validator/deployer are user-built nodes); fixed role taxonomy avoids reinvention per project; routing table.
- **Beats Crew on:** Durable graph execution; full trace observability; interrupt-and-edit-state primitive; mature platform.
- **Stealable:** Interrupt-then-edit-state pattern — let the lead pause a builder slice, edit the handoff inline, then resume without rerun.

### OpenAI Agents SDK (Swarm successor)
- **Does well:** Lightweight handoff primitive with explicit context transfer; built-in tracing UI; guardrails (input/output validation) first-class; minimal API surface.
- **Crew beats it on:** Multi-vendor model support (Agents SDK is OpenAI-first; LiteLLM for others); artifact-based memory; gate separation.
- **Beats Crew on:** Trace UI out of the box; explicit handoff primitive with context-budget control; smaller cognitive surface.
- **Stealable:** Guardrails as a thin pre/post hook around any agent run — input/output validators that fail-fast before tool execution.

### Anthropic Claude Agent SDK
- **Does well:** 14+ built-in tools; Agent Skills primitive; auto-compaction; session forking; fine-grained tool permissions; sessions API.
- **Crew beats it on:** Multi-agent role taxonomy + gates (SDK is single-agent + subagents; no review/validate/deploy primitives); explicit handoff contract; durable artifact memory.
- **Beats Crew on:** Session forking primitive (cheap branching); permission system granularity; first-party Anthropic alignment.
- **Stealable:** Session-fork primitive for reviewer — fork the builder's session into reviewer with full context preloaded instead of re-paying for repo grep.

### Cursor agent mode
- **Does well:** Background agents on cloud VMs; git-worktree parallel execution; deep IDE integration; ambient model switching.
- **Crew beats it on:** Inspectable open-source workflow; auditable handoffs; gate artifacts; portable across IDEs (Cursor is closed).
- **Beats Crew on:** UX polish; managed cloud VM execution; ambient model selection without config.
- **Stealable:** Background-agent pattern with native git worktree spawning — already aligned with Crew's "worktree parallelism" rules.

### Cline
- **Does well:** Plan / Act mode split; per-step approval; auditable tool-by-tool history; Apache-2.0 transparency.
- **Crew beats it on:** Multi-agent role separation; durable artifacts beyond conversation; routing-table skill discovery.
- **Beats Crew on:** UX-level per-tool approval gate; in-IDE conversational fluency.
- **Stealable:** Plan-then-Act mode as a Crew lead toggle — surface the proposed handoff chain for explicit approval before dispatch.

### Roo Code
- **Does well:** Built-in modes (Code / Architect / Ask / Debug) + custom personas; per-mode tool-set scoping; persona overlays.
- **Crew beats it on:** Cross-mode artifact persistence; explicit handoff between modes; gate enforcement.
- **Beats Crew on:** Persona system (modes have tunable personality + scope) without giving up single-agent simplicity.
- **Stealable:** Per-role tool-allowlist enforcement at dispatch time (reviewer cannot Edit, validator cannot push) — already aligned with Crew's role design, not yet enforced.

### MetaGPT
- **Does well:** SOP-encoded sequential assembly line (PM -> Architect -> Engineer -> QA); shared message pool; structured artifact per role; QA is a real review/test step.
- **Crew beats it on:** Routing table flexibility (MetaGPT SOP is hardcoded); gate separation beyond QA; live IDE plugin model vs Python SDK.
- **Beats Crew on:** SOP enforcement and structured-artifact-per-role convention; explicit waterfall-style traceability.
- **Stealable:** Structured-artifact-per-role schema — Crew already has this but could enforce schema validation per role (e.g. reviewer artifact MUST contain `verdict` + `coverage_notes`).

### AutoGPT (legacy)
- **Does well:** Self-prompted task decomposition; pioneered autonomous agents.
- **Crew beats it on:** Everything — gates, multi-agent, artifacts, cost discipline, durability.
- **Beats Crew on:** Mindshare (lower now); plugin ecosystem of dubious quality.
- **Stealable:** Almost nothing. Cautionary tale on unbounded self-prompted loops without gates — vindicates Crew's gate-first design.

### Devin (Cognition)
- **Does well:** Cloud sandbox with own IDE/browser/terminal; Devin Wiki auto-indexes repo; Interactive Planning before execution; ships PR as artifact.
- **Crew beats it on:** Inspectable open-source; multi-agent gate separation; cost transparency (Devin ACU billing is opaque); cross-vendor model support.
- **Beats Crew on:** Auto-indexed durable repo knowledge (Devin Wiki); plan-before-execute UX; PR-as-artifact integration with GitHub.
- **Stealable:** Auto-indexed repo Wiki on slice start — pre-compute and cache architecture summary so researcher doesn't redo it per slice.

### SWE-agent (Princeton/Stanford)
- **Does well:** Agent-Computer Interface (ACI) — careful tool design for an LM; strong on SWE-bench; academic rigor.
- **Crew beats it on:** Multi-agent gates; production workflow; artifacts.
- **Beats Crew on:** ACI rigor — tool error messages and formatting are tuned to help the LM recover, not just humans.
- **Stealable:** ACI tool-design lessons — Crew tool errors should optimize for *the agent reading them*, not the human (e.g. shorter, structured, with explicit recovery hint).

### Aider
- **Does well:** REPL-driven pair-programmer; git commit per change (history IS the memory); repo-map; multi-model.
- **Crew beats it on:** Multi-agent role separation; gates beyond git diff; reviewer/validator are first-class.
- **Beats Crew on:** Repo-map quality (LSP-aware code summary); commit-as-handoff simplicity; mature CLI UX.
- **Stealable:** Tree-sitter / LSP-based repo-map on session start — better than ad-hoc grep for bounded context retrieval.

### OpenHands (formerly OpenDevin)
- **Does well:** CodeAct loop (plan -> shell -> test -> iterate); test-suite-as-gate baked in; event stream as durable memory; delegation between agent types.
- **Crew beats it on:** Explicit review/validation/deploy gate separation; cost telemetry per slice.
- **Beats Crew on:** CodeAct loop; event-stream persistence; pause/resume primitive.
- **Stealable:** Event-stream-as-memory format — every tool call + result as a structured event, replayable for debugging without re-running the LLM.

### Smolagents (Hugging Face)
- **Does well:** Code-as-action loop in ~1k LoC; minimal API; Hub Spaces as tool sources; LangChain + MCP interop.
- **Crew beats it on:** Roles, gates, artifacts — Smolagents is intentionally a primitive.
- **Beats Crew on:** Code minimalism; tool-source diversity (Hub Spaces, LangChain, MCP all at once).
- **Stealable:** Aggressive footprint discipline — Crew skill files are already capped at 200 LoC; extend to agent prompts (300 cap exists, push for ≤200 like skills).

### Pydantic AI (v1.87)
- **Does well:** Typed deps/output; deferred tools + HITL approval as first-class registration flag (`requires_approval=True`); Graph + Durable Execution; Pydantic Evals; OpenTelemetry tracing; Restate/Temporal integrations for journaled progress.
- **Crew beats it on:** Multi-agent role taxonomy; committed-artifact memory.
- **Beats Crew on:** Type safety; deferred-tool pattern; evals as first-class; durable execution backed by Restate/Temporal; inline `HandleDeferredToolCalls` hook (v1.87 Apr 2026) for resolving deferred calls without halting the run.
- **Stealable:** `requires_approval=True` per-tool flag — promote Crew's `escalated_to_human` from a workflow badge to a per-tool annotation that the harness enforces before execution.

### Mastra
- **Does well:** Supervisor + sub-agents with automatic memory isolation per delegation (fresh threadId, deterministic resourceId); observational memory (Observer + Reflector compress history) — 94.87% on LongMemEval, no vector DB, prompt-cacheable; 3,300+ models / 94 providers; TS-native; Mastra Cloud.
- **Crew beats it on:** Gate separation; routing-table; Claude Code native integration.
- **Beats Crew on:** Observational memory is genuinely SOTA on long-running agents; multi-provider reach; TS-first.
- **Stealable:** Observer + Reflector pattern — a hook-driven compaction agent that summarizes the last N tool turns into a dense observation, replacing raw event log when context pressure rises. Direct fit for Crew's compaction discipline.

---

## 4. Differentiation analysis

**Crew's moat (defensible advantages):**
- **Gate composition as artifacts:** review -> validation -> deployment as separate, inspectable, committed files. No surveyed competitor enforces this trio; most treat "QA" as one role or one convention.
- **Routing-table as source of truth:** `docs/routing-table.md` is consulted by the lead; renaming a skill propagates across all agents in one edit. Competitors hardcode tool/skill bindings per agent.
- **Lead-routed bounded subagents with handoff contract:** `write-handoff` CLI returns path + headline; body never re-inflates lead context. Pydantic AI and OpenAI Agents SDK have explicit handoff primitives but neither couples it to context-budget protection.
- **Artifact-based durable memory committed to repo:** `.claude/artifacts/crew/` is the why-it-landed-this-way record. CrewAI/LangGraph checkpoint to DB; Mastra to observational store; none commit as code-adjacent durable history.
- **Explicit context-budget discipline as a per-agent contract:** "Researcher writes report via `write-handoff`, returns only path + 1-3 sentence headline." No other framework codifies this.
- **Roles-as-gates separation aligned to engineering reality:** reviewer/validator/deployer match how serious teams actually ship code. Free-form role frameworks (CrewAI, AutoGen, MAF) force every team to reinvent this.
- **HARD RULE + workflow-badge state machine:** `blocked`/`escalated_to_human` are first-class workflow states; `write-final-synthesis --force` refuses while escalated. Behavioral safety in code, not docs.
- **Loop companion as separate plugin:** autonomous backlog walker is opt-in, version-pinned, and inspectable — competitors that bundle autonomy (Devin, AutoGPT) lose the inspection seam.

**What is commoditized (no longer differentiating):**
- MCP integration — every serious framework now supports it.
- Multi-model support — Mastra (94 providers), CrewAI, LangGraph, MAF, OpenHands all match this.
- Skill/tool registration — table stakes.
- Single-agent code-loop quality — Cursor, Cline, Devin, Aider all converged here.
- Slash-command-based dispatch UI — Claude Code, Cursor, Cline all ship this.

---

## 5. Improvement opportunities

Ranked by leverage (impact / effort). Each: `[tag]` source -> change -> why it fits Crew.

1. **[stealable]** Mastra Observer+Reflector -> Add a `compaction-agent` hook that compresses the last N hook events into one structured observation when `workflow-state.json` size crosses a threshold. Why: Crew already pays compaction tax; SOTA pattern with no vector DB matches Crew's file-first philosophy. (highest leverage — direct context-cost win)
2. **[stealable]** Pydantic AI `requires_approval=True` per-tool -> Promote `escalated_to_human` from a session-level badge to a per-tool annotation enforced by `PreToolUse` hook. Why: Crew already has the badge plumbing; the per-tool variant is a small extension with large safety upside.
3. **[stealable]** OpenAI Agents SDK guardrails -> Ship input/output validator pre/post hooks per role (e.g. reviewer output MUST contain `verdict`, deployer output MUST cite an artifact path). Why: Crew has structured handoff format in docs but no schema enforcement at runtime — guardrails are the closing seam.
4. **[stealable]** Anthropic Claude Agent SDK session forking -> Wire `crew:reviewer` and `crew:validator` to fork the builder's session instead of cold-starting. Why: huge cost savings on cache reuse; aligns with existing "trust the harness file-state" cost-discipline rule.
5. **[stealable]** MAF CodeAct -> Let the builder emit a single TS/PowerShell script that batches tool calls instead of round-tripping. Why: Crew's `cost-advisor` already flags chained-bash-ops; CodeAct is the architectural answer.
6. **[stealable]** LangGraph interrupt-then-edit-state -> Add `crew pause --slice <id>` that captures live handoff, lets the lead edit it, then resumes the dispatched subagent. Why: today a `needs_fix` requires full re-dispatch; interrupt-edit is the cheaper path.
7. **[tooling]** Aider tree-sitter repo-map -> Replace ad-hoc grep at session start with an LSP/tree-sitter repo-map cached in `.claude/state/`. Why: every researcher dispatch currently re-pays for repo discovery; cache it.
8. **[novel]** Cross-framework portability bridge -> Publish Crew skills as agent-skills.io-compatible bundles so Cursor/Codex/Gemini-CLI users can adopt the gate discipline without Claude Code. Why: addresses the TL;DR gap on portability; turns Crew's content (skills + routing table) into a portable standard rather than a plugin-locked one.
9. **[policy]** SWE-agent ACI tool-error format -> Audit every Crew tool error to optimize for the agent reading it (short, structured, recovery hint). Why: cheap, high-impact on builder failure recovery; turns errors into evidence rather than dead ends.
10. **[tooling]** OpenHands event-stream-as-memory -> Persist every tool call + result as a structured event in `.claude/artifacts/loop/auto-dispatch.jsonl` (partial today) extended to all sessions, replayable without re-running the LLM. Why: durable debug seam; complements artifact-based memory.
11. **[stealable]** Devin Wiki auto-indexed repo summary -> Pre-compute architecture summary on `crew:adopt` and refresh on `crew:brief-me` if mtime is stale. Why: cuts researcher cold-start cost; complements existing routing table.
12. **[novel]** Trace UI for slice runs -> A read-only HTML render of `.claude/artifacts/crew/runs/<slice>/` showing handoffs as a swimlane diagram. Why: LangSmith / OpenAI Agents SDK / Pydantic AI all ship this; Crew has the data but no visualization.

---

## 6. Anti-patterns observed (what NOT to copy)

- **Free-form role authoring (CrewAI, AutoGen, MAF):** "describe an agent's goal and backstory" defers the engineering decision to every project, forcing each team to reinvent reviewer/validator. Crew's fixed taxonomy is correct.
- **Conversation-as-state (AutoGen, Cursor, Cline):** the chat log is the memory. Loses everything after compaction; not auditable. Crew's artifact-first model wins here.
- **SOP hardcoded waterfall (MetaGPT):** PM -> Architect -> Engineer -> QA fixed sequence. Too rigid for varied tickets; Crew's lead-routed dispatch is more adaptive.
- **Closed-source single-agent IDE (Cursor, Devin):** inspection seam is gone; teams cannot audit or version-pin behavior. Crew is plugin + open by design.
- **Self-prompted unbounded loops (AutoGPT):** no gates, no budget discipline, no role separation. Vindicates Crew's gate-first design.
- **Per-tool approval prompts as the only gate (Cline):** trades automation for user fatigue. Crew's role-as-gate composition is the better answer.
- **Single-vendor lock-in (OpenAI Agents SDK, Anthropic Claude Agent SDK):** Crew is already Claude-Code-only — a portability bridge (opportunity #8) is the lift, not a deeper bet.
- **Hosted-runtime-as-default (CrewAI Enterprise, Mastra Cloud, Devin):** turns the framework into a vendor relationship. Crew's "no server, no container" rule in `CLAUDE.md` is correct.

---

## 7. Sources

Cited per claim. Marked "could not verify" where docs unreachable from this environment.

**Crew baseline (repo-internal):**
- `C:\work\mega\hero-crew\README.md`
- `C:\work\mega\hero-crew\CLAUDE.md`
- `C:\work\mega\hero-crew\docs\architecture\architecture.md`
- `C:\work\mega\hero-crew\docs\routing-table.md`
- `C:\work\mega\hero-crew\CHANGELOG.md`
- `C:\work\mega\hero-crew\agents\reviewer.md`, `agents\validator.md`, `agents\deployer.md`
- `C:\work\mega\hero-crew\.claude\artifacts\crew\` (artifact taxonomy)
- `C:\work\mega\hero-crew\docs\governance.md` (300-line agent cap)

**CrewAI:** https://docs.crewai.com/ — orchestration patterns, MCP integration, Flows.

**AutoGen:** https://microsoft.github.io/autogen/ — UserProxyAgent, conversation-as-orchestration; status now superseded by MAF per devblogs.microsoft.com/agent-framework/.

**Microsoft Agent Framework:**
- https://devblogs.microsoft.com/agent-framework/microsoft-agent-framework-at-build-2026-announce/ — CodeAct, hosted agents.
- https://devblogs.microsoft.com/dotnet/durable-workflows-in-microsoft-agent-framework/ — Durable Task Scheduler.
- https://learn.microsoft.com/en-us/agent-framework/overview/ — 1.0 GA 2026-04-02, Python + .NET parity.
- https://github.com/microsoft/agent-framework

**LangGraph 1.2:**
- https://langchain-ai.github.io/langgraph/ — graph nodes, checkpointers, interrupts.
- https://docs.smith.langchain.com/ — LangSmith trace UI.

**OpenAI Agents SDK:** https://openai.github.io/openai-agents-python/ — handoff primitive, guardrails, sessions, tracing.

**Anthropic Claude Agent SDK:** https://docs.anthropic.com/en/docs/claude-code/sdk — built-in tools, skills, sessions; could not verify exact tool count beyond "14+".

**Cursor agent mode:** https://docs.cursor.com/ — background agents, worktree parallelism (marketing pages; closed source).

**Cline:** https://github.com/cline/cline — Plan/Act modes, per-tool approval.

**Roo Code:** https://github.com/RooVetGit/Roo-Code — fork of Cline; built-in modes + custom personas.

**MetaGPT:** https://github.com/geekan/MetaGPT — SOP, role taxonomy, shared message pool. Paper: https://arxiv.org/abs/2308.00352.

**AutoGPT:** https://github.com/Significant-Gravitas/AutoGPT — legacy autonomous agent.

**Devin:** https://devin.ai/ — public marketing + Cognition blog; internal architecture not published. "Devin Wiki" + Interactive Planning per https://docs.devin.ai/.

**SWE-agent:** https://swe-agent.com/ + https://arxiv.org/abs/2405.15793 — Agent-Computer Interface paper.

**Aider:** https://aider.chat/ — REPL, repo-map, git-commit-per-change.

**OpenHands:** https://github.com/All-Hands-AI/OpenHands — CodeAct, event stream.

**Smolagents:** https://huggingface.co/docs/smolagents/ — code-as-action loop, ~1k LoC, Hub Spaces tools.

**Pydantic AI:**
- https://ai.pydantic.dev/ — typed agents, deferred tools, durable execution.
- https://pydantic.dev/docs/ai/tools-toolsets/deferred-tools/ — `requires_approval=True`.
- v1.87 release (Apr 2026): `HandleDeferredToolCalls` hook per https://groundy.com/articles/pydantic-ai-v1-87-closes-the-langgraph-gap-deferred-tool-calls-opentelemetry/.
- https://temporal.io/blog/build-durable-ai-agents-pydantic-ai-and-temporal — Temporal integration.

**Mastra:**
- https://mastra.ai/blog/observational-memory — Observer + Reflector announcement (Feb 2026).
- https://mastra.ai/research/observational-memory — 94.87% LongMemEval, no vector DB.
- https://mastra.ai/docs/memory/observational-memory — implementation docs.
- https://www.generative.inc/mastra-ai-the-complete-guide-to-the-typescript-agent-framework-2026 — supervisor pattern, sub-agent memory isolation, 3,300+ models / 94 providers.

**Cross-framework portability (TL;DR claim):** agent-skills.io standard + https://github.com/netresearch/claude-code-marketplace — could not verify exact 30+ agent count from this environment; treat as "emerging standard, multi-host" rather than precise.
