# Competing harness research (as of 2026-11-05)

Legend: V = fetched from a primary or near-primary page this session. S = secondary blog only (UNVERIFIED). Codex changelog page (223k chars) was read only for Oct 2026 entries; May-Sep Codex items come from aggregators (S).

## OpenAI Codex CLI
URLs: https://github.com/openai/codex/releases (not fetched); https://learn.chatgpt.com/docs/changelog (V, redirected from developers.openai.com/codex/changelog)
- Subagents GA v0.115.0 2026-03-16 (S). Max concurrent cut 12 to 6 in v0.91.0 (S). Guardian subagent auto-reviews approvals (S).
- Oct 2026 (V): 0.163.0 (10-15) parallel read-only tool execution. 0.164.0 (10-23) /presets, inline /permissions, enterprise MCP auth, Guardian and compaction changes. 0.165.0 (10-27) environment-scoped managed hooks, configurable Guardian review timeout, experimental attached thread forks. 0.166.0 (10-29) skill catalogs can omit descriptions, incremental catalogs behind flag, approval settings preserved across resume/fork, reasoning-token accounting preserved to avoid premature compaction, processing tier and dollar usage in status line.
- Plugins launched 2026-03-25 (S); skills ship inside plugins; plugin commands migrate to skills (S). Role plugins June 2 (S).
- Steal for crew:
  1. Guardian: a separate low-cost reviewer agent that auto-approves or denies permission requests, with a timeout. Crew gate-guard could delegate ambiguous approvals to a reviewer subagent. M.
  2. Lean skill catalog (names only, descriptions loaded on demand). Crew has 49 skills. S.
  3. Persist approval/gate state across resume and fork. Slice resume should carry gate state. S.

## Gemini CLI
URL: https://geminicli.com/docs/changelogs/ (V); https://github.com/google-gemini/gemini-cli/discussions/24548 (S)
- Subagents preview v0.36.0 (2026-04-02), public v0.38.1 (04-16); markdown+YAML agent files in .gemini/agents (S).
- Policy engine persistent approvals v0.38.0 (S). v0.58.0 (2026-09-01, V) safety checkers declared in write-policy config. v0.59.0 fail-closed workspace trust and MCP OAuth SSRF hardening. v0.60.0 consent prompts for env changes.
- Plan mode: v0.52.0 relative-path write policy (07-22). v0.63.0 (2026-10-06) autonomous plan execution in non-interactive mode (V).
- v0.43.0 session export/import and adaptive token estimation (05-22). v0.64.0 atomic file ops and state persistence with backup recovery (10-13) (V).
- Gemini CLI replaced by Antigravity CLI for unpaid/Google One users 2026-06-18 (V). Do not bet on it.
- Steal for crew:
  1. Fail-closed workspace trust and env-var sanitization for hooks and scripts. S-M.
  2. Plan phase may only write plan artifacts (path allowlist), enforced by hook not prose. S.
  3. Atomic writes plus backup recovery for .claude/state files (workflow-state races). S.

## GitHub Copilot CLI, gh skill, gh-aw
URLs (V): https://github.blog/changelog/2026-02-25-github-copilot-cli-is-now-generally-available/ ; https://github.blog/changelog/2026-04-16-manage-agent-skills-with-github-cli/ ; https://github.blog/changelog/2026-06-11-github-agentic-workflows-is-now-in-public-preview/ ; https://github.github.com/gh-aw/blog/2026-06-01-weekly-update/
- Copilot CLI GA 2026-02-25.
- gh skill (public preview 2026-04-16, gh 2.90+): search, preview, install, update, publish. --pin to tag/SHA. Provenance (repo, ref, tree SHA) written into SKILL.md frontmatter. Publish validates against Agent Skills spec, checks tag protection and secret scanning, enables immutable releases. Targets Copilot, Claude Code, Cursor, Codex, Gemini CLI, Antigravity.
- gh-aw: technical preview 2026-02-13, public preview 2026-06-11. Markdown workflows compiled to Actions. Read-only by default. "Safe outputs": agent proposes, separate job applies. Threat-detection job scans proposed changes. Agent Workflow Firewall container sandbox. Integrity filter on GitHub content. Per-workflow 24h AI-Credits budget guardrail (v0.77.4). Workload Identity Federation instead of stored API keys. Engines include copilot, claude, copilot-sdk.
- Steal for crew:
  1. Safe-outputs: builder emits a structured proposal; a distinct privileged step applies it after threat and secret scan. Maps onto the review gate. M.
  2. Hard per-run cost budget with stop. Loop snapshot shows about $2433 per iteration and no cap. S-M.
  3. Skill provenance in frontmatter, pinning, immutable tagged releases. S.
  4. Ship crew skills installable via gh skill. M.

## Standards: Agent Skills, AGENTS.md, MCP, A2A
- Agent Skills: spec opened 2025-12-18. agentskills.io reportedly lists 40+ clients by Sep 2026 incl. Claude, Codex, Gemini CLI, Cursor, Copilot, OpenCode, Amp, Goose (S; site not fetched, count UNVERIFIED). 341 malicious skills found on ClawHub by 2026-02-03 (S).
- MCP 2026-07-28 (V, https://blog.modelcontextprotocol.io/posts/2026-07-28/; RC 2026-05-21): stateless core (no initialize, no Mcp-Session-Id). Elicitation via Multi Round-Trip Requests (input_required result, client retries). Tasks moved to official extension io.modelcontextprotocol/tasks (poll tasks/get, tasks/update). Extensions framework (Tasks, MCP Apps, Enterprise Managed Auth). Mcp-Method/Mcp-Name headers. ttlMs/cacheScope. RFC 9207 iss validation. CIMD replaces DCR. Roots, Sampling, Logging deprecated (12-month window). SSE transport deprecated.
- A2A: not researched. UNVERIFIED.
- AGENTS.md: no new 2026 spec news found; crew already includes it.
- Steal for crew:
  1. Make skills pure Agent Skills (SKILL.md only, no Claude-only fields), with a build step emitting per-harness bundles. Agents and commands stay Claude-specific. M-L.
  2. MCP Tasks extension as the long-running slice status primitive if crew exposes an MCP server. L.

## Others (S, mostly https://tech.grahammiranda.com/ai-coding-harness-comparison/ Oct 2026; verify before relying)
- OpenCode v2: single background service all UIs attach to; background subagents on a different model; ordered allow/ask/deny rules (last match wins) plus hard-deny; per-step snapshots with /undo; Code Mode for MCP; v2.1.0 (10-20) todo lists.
- Amp: subagents, Oracle, hosted "orbs" billed per minute.
- Goose: shareable recipes; donated to Linux Foundation AAIF April 2026.
- Crush (Charm): LSP-based context; mid-session model switch.
- Factory droid: Missions (long-running) in Mission Control; built-in code review; droid exec headless.
- Cline: concurrent subagent tool calls, agent teams, Kanban board; plan mode hard-blocks file-editing shell commands.
- Kilo Code: rebuilt on OpenCode; Anaconda acquired July 2026. Roo Code final release 2026-05-15, read-only.
- Junie CLI: standalone model-agnostic since March 2026; imports Claude Code/Codex settings.
- Mistral Vibe 3.0 (2026-10-19): task-tool subagents, read-only explore agent, /branch fork, Agent Skills format, org-wide MCP kill switch.
- Qwen Code: subagents, agent teams, Agent Arena (several models on one task), headless CI.
- Kimi Code: coder/explore/plan subagents, plugin marketplace with trust levels, hooks gating tool calls.
- Hermes Agent v0.22: LSP diagnostics (pyright, gopls, etc.) fed back after every edit; /rollback checkpoints; up to 10 subagents with live steering.
- Steal for crew:
  1. LSP/diagnostics feedback after each builder edit as a cheap pre-review gate. M.
  2. Ordered allow/ask/deny policy file with hard-deny shared by hooks. M.
  3. Per-agent model in frontmatter (cheap explorer, strong reviewer). S.
  4. Agent Arena: two models on one high-risk slice, reviewer picks. L.
  5. Goose-style recipes as portable command bundles. M.

## Top-5 ranked
1. Safe-outputs split (propose vs apply) plus threat/secret scan (gh-aw). Strengthens the review gate. M.
2. Hard per-run and per-slice budget guardrail (gh-aw AI-Credits, Codex dollar usage). S-M.
3. Portable Agent Skills packaging with provenance and pinning (gh skill, agentskills.io). Biggest generalization lever. M-L.
4. Reviewer-as-approver (Guardian) plus ordered allow/ask/deny policy with hard-deny and fail-closed trust. M.
5. Post-edit diagnostics (LSP) and checkpoints/rollback before review (Hermes, OpenCode). M.

## Gaps (UNVERIFIED / not covered)
Codex May-Sep entries; agentskills.io adopter list; A2A; primary changelogs for Amp, Goose, Crush, OpenCode, Factory; Copilot CLI Aug 2026 items.
