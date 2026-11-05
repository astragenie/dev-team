# Platform research: Claude Code changes since ~May 2026 (as of 2026-11-05)

Latest Claude Code release verified: v2.1.318 (2026-11-04), via GitHub releases API. Changelog entries are undated in the raw file; version-to-date only verified for 2.1.314 (2026-10-30), .316 (10-31), .317 (11-03), .318 (11-04). All other version numbers come from docs "version notes" tables (fetched) and are undated.

All items below were fetched from code.claude.com docs, raw GitHub CHANGELOG, or raw marketplace.json unless marked UNVERIFIED.

## 1. Hooks

| Item | Version | Source | Crew impact | Rec | Effort |
|---|---|---|---|---|---|
| 33 hook events now (added: Setup, UserPromptExpansion, StopFailure, PermissionRequest, PermissionDenied, PostToolBatch, InstructionsLoaded, ConfigChange, CwdChanged, DirectoryAdded, FileChanged, PreModelSwitch, PostModelSwitch, Elicitation(Result), MessageDisplay, PostCompact) | n/d | https://code.claude.com/docs/en/hooks | Crew registers TaskCreated/TaskCompleted/SubagentStart/Stop/etc via log_event.sh. Several new events replace custom machinery: PostToolBatch (once per tool batch, can inject additionalContext/block), PostCompact, PreModelSwitch (model-enforce), StopFailure (API-error termination), PermissionDenied (retry:true) | ADOPT PostToolBatch for check-task-update-burst / redundant-read; PostCompact for checkpoint-cadence; StopFailure for cost telemetry on failed slices | M |
| Hook types: `http`, `mcp_tool`, `prompt`, `agent` besides `command` | n/d | hooks doc | `prompt`/`agent` hooks could replace brittle regex gates (check-reviewer-decision, check-subagent-return). Note concurrency cap 24 prompt/agent hooks per session (2.1.312). `agent` hook is "experimental" | EVALUATE; keep command hooks for deterministic gates | M |
| Exec form: `args` array (no shell) vs shell-form `command` | n/d | hooks + plugins-reference | Crew hooks use shell form `bun "${CLAUDE_PLUGIN_ROOT}/hooks/x.ts"`. On Windows default shell is PowerShell when Git Bash missing; exec form avoids quoting/shell issues. 2.1.309: Windows PreToolUse/PermissionRequest hooks failed OPEN without Git for Windows (fixed) | ADOPT exec form `{command:"bun", args:[".../x.ts"]}` | S |
| `onFailure: "block"` on hook handlers (fail-closed) | 2.1.295 (cmd hooks), 2.1.317 (SDK callbacks) | hooks doc; CHANGELOG | Gate hooks (gate-guard, artifact-lock) currently fail open on crash/timeout (non-2 exit = non-blocking). `onFailure:"block"` makes enforcement hooks fail closed | ADOPT on enforcement hooks | S |
| `if` conditions on hooks (e.g. `Bash(git push *)`) | n/d (referenced in 2.1.314) | CHANGELOG | Replace in-script command sniffing in pre-tool-use-bash-gate / pre-push-verifier to avoid spawning bun per Bash call | ADOPT | S |
| `PreToolUse` `permissionDecision: allow/deny/ask/defer`, `updatedInput`; `defer` for headless (-p) pause/resume | n/d | hooks doc | Crew's PreToolUse hooks already use hookSpecificOutput.permissionDecision (hooks/lib/model-routing-enforce.ts, dispatch-size-estimate.ts). `defer` enables human-in-loop for the autonomous loop (pause at gate, resume with `claude -p --resume`). Top-level PreToolUse `decision`/`reason` is DEPRECATED (approve->allow, block->deny); I grepped hooks/ and found no use | ADOPT defer for loop approval points; no migration needed | M |
| `updatedToolOutput` (PostToolUse); `updatedMCPToolOutput` deprecated | n/d | hooks doc, SDK CHANGELOG | Not used by crew | IGNORE | - |
| SessionStart output: `initialUserMessage`, `watchPaths`, `sessionTitle`, `reloadSkills` | n/d | hooks doc | Could inject wake-up context + title slice sessions | ADOPT (sessionTitle for slice id) | S |
| `additionalContext` capped 10,000 chars/field; PreCompact output capped 10,000 | 2.1.314 | CHANGELOG | Check any hook injecting loop snapshot/wake-up context for size | AUDIT | S |
| Windows: PowerShell exit-2 blocking fixes | 2.1.309, 2.1.316 | CHANGELOG | Relevant (user is on Windows 11) | NOTE | - |
| Subagent frontmatter `Stop` hook auto-converted to SubagentStop | n/d | hooks doc | n/a for plugin agents (see below) | IGNORE | - |
| Shell-form `${user_config.*}` substitution removed | 2.1.207 | hooks doc | Only matters if crew adds userConfig | NOTE | - |
| SubagentStop firing ~2x/min per subagent bug | fixed 2.1.311 | CHANGELOG | otel-subagent-stop.ts double counting risk before 2.1.311; require >=2.1.311 | NOTE | - |

TeammateIdle / TaskCreated / TaskCompleted: STILL EXIST and are NOT deprecated; docs say exit code 2 blocks/feeds back (hook "quality gates" for agent teams). So crew's TaskCreated/TaskCompleted registration is valid. Crew currently only logs them; they can be used as blocking gates.

## 2. Plugin manifest and layout

Source: https://code.claude.com/docs/en/plugin-reference (plugins-reference.md).

- New manifest fields: `displayName`, `defaultEnabled`, `dependencies` (plugin deps with version constraints), `settings` (only `agent`, `subagentStatusLine` honored), `userConfig` (typed, sensitive-in-keychain, `options` v2.1.271), `channels`, `lspServers`, `outputStyles`, `workflows` (plugin-distributed Workflow .js), `experimental.{themes,monitors,evals}`, `metadata` (2.1.222), `commands` as object map with `source|content`, `argumentHint`, `model`, `allowedTools`.
- `commands/` is documented as legacy: "Prefer skills/ for new plugins". Commands and skills merged (`.claude/commands/x.md` == skill). Crew has 35 commands -> candidates to migrate to skills (gains: `name`, `paths`, supporting files, `disable-model-invocation`, `context: fork`).
- `bin/` directory: executables on Bash tool PATH while plugin enabled. Crew could ship `crew` CLI/scripts there instead of `node ./scripts/*.ts` indirection. (claude.ai/Cowork will not install plugins with bin/.)
- `monitors/monitors.json` (experimental): background process per session, can start `on-skill-invoke:<skill>`. Fit: cost/loop watcher. Monitors do not start with `-p`.
- `settings.json` at plugin root can set default `agent` (main-thread agent). Could make crew dispatcher the default agent when plugin enabled: M.
- `claude plugin validate [--strict]`: authoritative manifest check; v2.1.233 also validates agent dirs; MCP checks 2.1.281. Crew has its own validate-manifests/skills/agents; add `claude plugin validate --strict` to CI as a cheap superset check. S.
- Reserved plugin names: starts with `claude-`, `anthropic-`... is an ERROR. Crew's package/plugin name is `crew-plugin` / marketplace `crew` - OK; do NOT rename to `claude-crew`.
- `${CLAUDE_PLUGIN_ROOT}` is NOT deprecated. Documented, current. Also `${CLAUDE_PLUGIN_DATA}` (persists across updates; use for caches/node_modules instead of writing state under root, which changes on update) and `${CLAUDE_PROJECT_DIR}` (stays at project root even after entering a worktree; use hook input `cwd` for worktree path). Neither var exists in Bash-tool environment, only hooks/MCP/LSP and Markdown-body substitution in skills/commands/agents.
- Plugin subagent restrictions: `hooks`, `mcpServers`, `permissionMode`, `initialPrompt` in plugin agent frontmatter are IGNORED (security). Check crew's 23 agents: any `permissionMode`/`hooks` frontmatter is dead. Plugin agents are scoped e.g. `crew-plugin:reviewer`. Impact: HIGH-value audit item. S.
- CLAUDE.md at plugin root is not loaded (validate warns). Context must go in skills.

## 3. Skills

Source: https://code.claude.com/docs/en/skills

- Frontmatter now: `name`, `description`, `when_to_use`, `argument-hint`, `arguments`, `disable-model-invocation`, `user-invocable`, `allowed-tools`, `disallowed-tools`, `model`, `effort`, `context: fork`, `agent`, `background`, `hooks`, `paths`, `shell`. Unknown fields ignored (but hard error on claude.ai upload).
- Description + when_to_use truncated at 1,536 chars in the listing. Crew has 49 skills; check cap.
- Auto-compaction re-attaches only first 5,000 tokens per skill within 25,000 combined budget. Crew skills <=200 lines is OK, but many invoked skills get dropped after compaction.
- `paths` globs gate auto-loading (cheap: domain skills only load for matching files). ADOPT for domain tier. S.
- `context: fork` + `agent:` runs a skill as a subagent; waits in headless/SDK/scheduled runs. Overlaps crew's dispatcher fan-out for single-specialist commands. EVALUATE. M.
- Skill `hooks` frontmatter (registered while skill invoked): lets gating hooks live with the workflow skill rather than global hooks.json. M.
- Dynamic context injection `!`cmd`` / ```! blocks; failure aborts invocation (use `|| true`). Could replace wake-up/brief-me boilerplate. S.
- `/skill-doctor` (2.1.252): context cost + usage per skill, flags never-invoked skills. Run against crew's 49 skills; remove/disable-model-invocation dead weight. S.
- `/doctor prompt-audit` (2.1.283): audits CLAUDE.md/AGENTS.md/rules/skills/subagents for conflicts/outdated content. Run on this repo's heavy instruction stack. S.
- `claude plugin eval` (2.1.269): suite in `evals/`, cases with prompt.md + graders (regex, tool_used, tool_order, file_exists, llm, baseline), 3 runs/case default, with/without-plugin baseline arm, `--threshold`, CI gating, html report. Source: https://code.claude.com/docs/en/plugin-evals. Directly relevant: crew has GEPA prompt optimization + `evals/`; a first-party skill-trigger/regression eval is cheaper than custom harness for "does skill X fire, does reviewer gate run". Cost: real model calls. ADOPT for trigger/regression evals; keep GEPA for prompt search. M.
- Bundled skills: /batch, /debug, /loop, /claude-api, /verify, /run, /simplify, /code-review, /run-skill-generator, /workflow-authoring, /deep-research (workflow). `/verify` and `/simplify` are run before commits as of 2.1.286 (CHANGELOG-derived note in docs table). Overlap with crew's validator/reviewer.
- `skillOverrides` setting to turn individual skills on/name-only/off; plugin skills not affected.
- Reserved names: `synced`, `anthropic-skills`.

## 4. Agents / subagents

Source: https://code.claude.com/docs/en/sub-agents

- Frontmatter fields: name, description, tools, disallowedTools, model (`sonnet|opus|haiku|fable|full id|inherit`), `effort` (low..max), permissionMode (not for plugin agents), `isolation: worktree`, `memory: user|project|local`, `background`, hooks (not plugin), `maxTurns` (partial output + resumable, 2.1.246), `autoCompactWindow` (2.1.296), `skills` (preload up to 32), mcpServers (not plugin), `omitClaudeMd` (2.1.271; cuts CLAUDE.md load for lean specialists, big token saver given this repo's large CLAUDE.md stack), `color`, `experimental.cacheTtl`.
- Per-invocation `effort` parameter (2.1.292), `CLAUDE_CODE_SUBAGENT_EFFORT` (2.1.316), `CLAUDE_CODE_SUBAGENT_MODEL(_FORCE)`. Model precedence: invocation > frontmatter > env (changed 2.1.251). Crew's pre-tool-use-model-enforce hook should be re-checked against this precedence.
- Nested subagents: default up to 3 layers (docs); SDK CHANGELOG says SDK default depth cap 1 (0.3.217). `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` controls. Crew "peer dispatch" (FEAT-163, 10 agents with `Agent` tool) relies on this; in `claude -p`/SDK with fork mode off, nested subagents start in background and parent does NOT wait. Verify loop behavior. M.
- `CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS` default 20.
- Subagents can message each other when named (SendMessage), and are resumable.
- `isolation: worktree`: temp worktree branched from default branch (`worktree.baseRef: fresh|head`); worktree with changes persists until sweep (`cleanupPeriodDays`). Fixed in 2.1.311: worktree removed while background subagent still used it. Crew's builder agents that edit in parallel are natural fit; `.worktreeinclude` copies gitignored files. ADOPT `isolation: worktree` for builders in parallel fan-out instead of dispatcher-managed worktrees. M.
- Task tool renamed Agent (v2.1.63); `Task(...)` still works.

## 5. Agent Teams, Workflow tool, scheduling

- Agent Teams: EXPERIMENTAL, off unless `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`. Shared task list, mailbox at ~/.claude/teams/{name}/inboxes, TeammateIdle/TaskCreated/TaskCompleted hooks, one team per session, no nested teams, no resume of in-process teammates, not in `-p`/SDK. Source: https://code.claude.com/docs/en/agent-teams. Caveat: when enabled, ANY named subagent launches as a teammate. Rec: IGNORE for the autonomous loop (non-interactive unsupported); document the interaction. Cross-session messaging doc (https://code.claude.com/docs/en/cross-session-messaging.md) exists (title only verified).
- Dynamic Workflows (Workflow tool): GA on paid plans/API/Bedrock/Vertex/Foundry. JS script with `agent()`, `pipeline()`, `parallel()`, `phase()`, `log()`, `args`; schema-validated structured output; resumable within session (replay by agent-start order); up to 16 concurrent agents (env up to 256, >=2.1.269), 1,000 agents/run, 4,096 items per call; `ultracode` keyword/`/effort ultracode` (2.1.284); saved to `.claude/workflows/` or shipped in plugin `workflows/` dir (namespaced `/crew-plugin:name`); `/workflows` progress UI; `/deep-research` bundled; usage-limit pause/resume (2.1.271). Not in `-p` for ultracode keyword, but Workflow tool runs in `-p`/SDK if permitted (`Workflow` allow rule, auto/bypass mode, or PreToolUse allow). Source: https://code.claude.com/docs/en/workflows. WHY IT MATTERS: crew's slash-command dispatchers + loop walker are prompt-driven orchestration where Claude is the orchestrator and every result lands in context. Workflows move loop/branching/fan-out into code with schema'd outputs and adversarial cross-checks, which is exactly the review/validation gate pattern (builder -> parallel reviewer+validator -> fix loop "until pass or 2 rounds no progress" is a listed example). Rec: PROTOTYPE `/crew:build` slice pipeline and parallel review fan-out as plugin `workflows/*.js`. Risks: Date.now/Math.random throw; no import(); no mid-run user input (so run stages as separate workflows for sign-off). L.
- Scheduled tasks (formerly routines; `/schedule`, alias `/routines`): research preview; schedule/API(`/fire`, beta header experimental-cc-routine-2026-04-01)/GitHub triggers; cloud-run; 100 runs/hr/account, 30/hr/task for run-now+API; min interval 1 hour; GitHub trigger via CLI needs 2.1.225+. Source: https://code.claude.com/docs/en/routines. Local alternatives: `/loop` and desktop scheduled tasks. Fit: nightly crew cost report / backlog-drift / validate-* sweeps; PR review on GitHub events. Not a replacement for the interactive slice loop. ADOPT for periodic hygiene. S-M.
- Permission modes: `default|acceptEdits|auto|dontAsk|bypassPermissions|plan` (+`manual` alias). New: `auto` mode with classifier (blocks approval claims relayed by other agents; messages between agents reviewed), `/auto-mode-setup` (2.1.304), `permissions.blockWritesOutsideWorkingDirectories` (2.1.314; removes EnterWorktree tools!), `sandbox.allowNestedUserNamespaces`, bypass mode now denies `rm`/`rmdir` immediately with a rewrite hint (2.1.309). Crew's autonomous loop under bypass will hit the rm denial. M.

## 6. Worktrees (https://code.claude.com/docs/en/worktrees)

`claude --worktree name` -> `.claude/worktrees/<name>`, branch `worktree-<name>`; `--worktree "#1234"` from PR/MR; `worktree.baseRef`; `.worktreeinclude`; `EnterWorktree/ExitWorktree` tools; isolation enforcement blocks edits/commands/git redirects into main checkout (applies to subagents; PowerShell only gets cwd check); WorktreeCreate/Remove hooks; `${CLAUDE_PROJECT_DIR}` does not follow into worktree (use hook input `cwd`); LFS filter drivers skipped; sweep removes subagent worktrees older than `cleanupPeriodDays`. Crew loop docs say "sibling git worktrees ... own .claude/state". With native isolation, state paths keyed off CLAUDE_PROJECT_DIR in hooks will point at the MAIN checkout, not the worktree: potential cost-attribution bug for the per-worktree `.claude/state/`. Verify. Rec: audit hooks/lib for CLAUDE_PROJECT_DIR vs `cwd`. S-M.

## 7. Memory

Source: https://code.claude.com/docs/en/memory
- CLAUDE.md or AGENTS.md both read (AGENTS.md supported natively). `.claude/rules/*.md` with `paths:` frontmatter (path-scoped, lazy load); symlinked shared rules need approval. Guidance: <200 lines per CLAUDE.md; `claudeMdExcludes`. Auto memory: Claude-written notes per repo shared across worktrees, first 200 lines/25KB loaded; subagents can have `memory:` scope. `/doctor prompt-audit`. Write tool now asks to read huge CLAUDE.md first (2.1.312).
- Crew impact: crew's own repo-memory (docs/memory.md, .claude/crew/*.md, wake-up context) overlaps conceptually with auto-memory + rules. Move path-specific instructions from CLAUDE.md into `.claude/rules/` with `paths`; consider subagent `memory: project` for reviewer lessons (overlaps with astramem agent-profile feature). M.

## 8. Telemetry / cost

Source: https://code.claude.com/docs/en/monitoring-usage
- Built-in OTel (metrics, events, traces beta): `claude_code.cost.usage` (attrs model, query_source main|subagent|auxiliary, speed, effort, + agent/skill/plugin/MCP attribution), `claude_code.token.usage`, events `api_request` (cost_usd, cost_usd_micros, tokens, request_id), `api_error`, `api_refusal`, `tool_result`, `tool_decision` (classifier_verdict, permission_mode 2.1.301), `user_prompt`; correlation `prompt.id`, `tool_use_id` joins hooks to tool events; traces: `claude_code.interaction|llm_request|tool` via `CLAUDE_CODE_ENHANCED_TELEMETRY_BETA=1`. Repo `.claude/settings.json` cannot enable telemetry or choose destination (only user/managed settings or env). 2.1.317 added `anthropic.plan|seat_type|provider`; 2.1.312 removed `claude_code.safety_event`. 
- Crew has otel-post-tool-use.ts, otel-stop.ts, otel-subagent-stop.ts + cost-report/cost-advise scripts that appear to hand-roll cost attribution per run/slice. Native OTel already attributes cost per agent/skill/plugin and per subagent. Rec: REPLACE hand-rolled token/cost capture with a thin OTLP file/collector reader for run attribution (keep slice->run mapping, which is crew-specific; inject via `OTEL_RESOURCE_ATTRIBUTES=slice.id=...`); L. Caveat: requires user env, not shippable via plugin settings; so keep a fallback.
- Gateway cost endpoint `GET /v1/organizations/analytics/cost` (2.1.317 changelog bullet: "Gateway: Added a cost report endpoint"). Org-level; UNVERIFIED beyond CHANGELOG line.
- `session-report` official plugin: HTML usage report. `receipts`: local usage impact report.

## 9. Agent SDK (outside the terminal)

Sources: https://code.claude.com/docs/en/agent-sdk/overview.md, https://raw.githubusercontent.com/anthropics/claude-agent-sdk-typescript/main/CHANGELOG.md (entries undated; ordering only).
- Python + TS SDKs; loads `.claude/` skills, commands, memory, plugins by local path (`plugins`, `reloadPlugins()`, `plugin_errors`), hooks (callback form, `onFailure:"block"` 0.3.317, PostToolUse `classifierContext`, Stop/SubagentStop `additionalContext`), subagents (`AgentDefinition` gains `autoCompactWindow`, `omitClaudeMd`; messages carry `agent_id`, tasks `parent_task_id`), sessions (resume/fork, `prewarm()`, `session_writes_lost`), cost (`total_cost_usd`, ModelUsage with thinkingTokens, cache splits, `costBasis`, rate-limit `overageEnabled`), `background_tasks_changed`, `result_index/resume_reason`, Workflow tool via permission rules/`canUseTool`.
- Behavior changes to note: nested subagents off by default with depth cap 1 in SDK (0.3.217) while CLI default is 3; fork subagents on by default in SDK sessions (0.3.302); task-tracking tools no longer default on newer models, must be in `tools`/`allowedTools` (0.3.233/0.3.268); PreToolUse `updatedInput` now validated, unknown keys dropped (0.3.300); `FileReadOutput.file_unchanged` removed (0.3.317; matches CLI 2.1.317 removing "file unchanged" stub, which may affect crew's check-redundant-read hook / record-read-content assumptions); `bypass_permissions_disabled` removed from ExitReason; Node >=18.14.
- Auth rule: third parties may not offer claude.ai login for SDK products; use API key. Internal crew use is fine.
- Fit: A headless slice walker can be an SDK app (typed hooks, cost per slice from `ModelUsage`, `canUseTool` for gate approvals, session resume per slice) rather than a loop driven by slash commands inside a terminal. L. Alternative lower-effort: `claude -p --output-format stream-json` with `defer` hook for approvals. Also "Managed Agents" (hosted harness; `multiagent_20261001` subagent teams default in /claude-api, 2.1.309) is a separate hosted option: UNVERIFIED beyond CHANGELOG lines.

## 10. Official plugin overlap (claude-plugins-official, 167+ entries)

Source: https://raw.githubusercontent.com/anthropics/claude-plugins-official/main/.claude-plugin/marketplace.json (verified; list read through the end of the file). NOT found in the official marketplace file: `gstack` (appears to be a third-party/user-installed plugin; present in this user's skill list, not official) and `security-review` as plugin name (the security-review slash command is built in; the official plugin is `security-guidance`).

| Official plugin | Description (verified) | Overlap with crew |
|---|---|---|
| code-review | Multi-agent PR review | crew:reviewer, reviewer-verifier, review gate; built-in `/code-review` also exists (low..max, ultra in cloud, --comment/--fix) |
| pr-review-toolkit | PR review agents for comments, tests, errors, types, simplification | crew specialist reviewers; granular agents crew might wrap rather than re-author |
| code-simplifier | code simplification agent | + built-in `/simplify` |
| security-guidance | Security review of Claude-generated code | crew security specialist/skills; built-in `/security-review` |
| feature-dev | Feature development workflow | crew:build |
| commit-commands | Git commit, push, and PR commands | crew:ship git steps |
| hookify | Custom hooks from markdown rules | crew hook authoring; lets users add gates without TS |
| plugin-dev | Toolkit for developing plugins | crew's own plugin authoring/validators, docs/governance |
| superpowers | Brainstorming, subagent workflows, debugging, TDD, skill authoring | crew workflow tier skills (TDD, debugging, subagent-driven dev, writing-skills) |
| skill-creator | Creates, improves, benchmarks skills | crew meta tier / GEPA skill optimization (skill-creator uses a different `evals/evals.json` format than `claude plugin eval`) |
| ralph-loop | Self-referential loops for iterative development | loop plugin / autonomous slice loop (concept overlap, much simpler) |
| claude-md-management | CLAUDE.md maintenance | crew memory write-back discipline |
| claude-code-setup | Recommends hooks, skills, MCP servers | crew installer/doctor |
| agent-sdk-dev | Dev kit for Agent SDK | relevant if loop moves to SDK |
| session-report | HTML report of session usage | crew cost-report |
| remember | Continuous memory, daily logs | astramem/docs/memory.md |
| project-artifact | Living project status page artifact | crew brief-me/fleet |
| mattpocock-skills | Engineering skills: grilling, specs, TDD, review | crew spec/TDD skills |
| coderabbit, greptile, qodo, sonarqube, semgrep | external review/analysis | crew reviewer integrations |
| context7, microsoft-docs, playwright, github, gitlab, sentry, lumen, serena | MCP/doc/search | already wired in routing-table (context7, microsoft-docs) |
| mlflow, deepeval, langfuse(-observability) | LLM eval / tracing | GEPA eval, OTel |
| *-lsp (typescript, pyright, gopls, etc.) | language servers | enable for crew consumers; background subagents can use LSP (2.1.280) |

Differentiators crew keeps (no official equivalent seen): the ownership/handoff/review-validation-deployment gate artifacts under `.claude/artifacts/crew/*`, slice loop ceremony, GEPA, cost-advise, backlog tree. Strategic risk: generic review/security/commit/feature-dev/TDD/plugin-dev capabilities are commoditized; the repo's own README note says it is superseded by unified "devcrew" (astragenie/dev-crew) per latest commit 72d0b88c, so recommendations should be applied there, not here.

## 11. Deprecations / removals relevant to crew

| Item | Status | Source |
|---|---|---|
| `${CLAUDE_PLUGIN_ROOT}` | NOT deprecated; current and documented | plugins-reference |
| TeammateIdle / TaskCreated / TaskCompleted | NOT deprecated; still in 33-event list, exit 2 blocks | hooks, agent-teams |
| PreToolUse top-level `decision`/`reason` | DEPRECATED (use hookSpecificOutput.permissionDecision); crew hooks already comply (grep) | hooks |
| PreToolUse ExitPlanMode `allowedPrompts` | deprecated, ignored | hooks |
| PostToolUse `updatedMCPToolOutput` | deprecated; use `updatedToolOutput` | hooks, SDK changelog |
| Shell-form `${user_config.*}` | removed 2.1.207 | hooks |
| `teammateDefaultModel` setting | removed 2.1.234 | agent-teams |
| `claude_code.safety_event` OTel | removed 2.1.312 | CHANGELOG |
| `claude daemon restart` | disabled 2.1.311 | CHANGELOG |
| Opus 4.8 fast mode | deprecated 2026-10-30, removed 2026-11-30, errors rather than falls back; migrate to Opus 5.5 | CHANGELOG 2.1.316. Crew `/fast` or model-routing tables naming Opus 4.8 fast need update |
| Read tool "file unchanged" stub | removed 2.1.317 | CHANGELOG; check crew check-redundant-read / record-read-content assumptions |
| Custom commands | legacy, merged into skills | skills, plugins-reference |
| Task tool name | renamed Agent (2.1.63), alias kept | sub-agents |
| bun requirement | NOT a platform change. Hooks are arbitrary commands, so bun is fine, but Windows PowerShell default shell + missing Git Bash caused fail-open on PreToolUse (fixed 2.1.309). Bun is a consumer install burden; Node 22.6+ already required for scripts. Consider exec-form + `node --experimental-strip-types` to drop the bun requirement for hooks (or ship precompiled JS) | hooks, CHANGELOG |
| `Skill` in SDK allowedTools | deprecated (0.2.133) | SDK changelog |
| Plugin agent frontmatter `permissionMode/hooks/mcpServers` | ignored for plugin agents | sub-agents |

## 12. Prioritized adoption list (crew)

1. S: add `onFailure:"block"` + exec-form `args` + `if` filters to enforcement hooks (gate-guard, artifact-lock, bash-gate, pre-push-verifier).
2. S: audit agent frontmatter for ignored fields (permissionMode/hooks/mcpServers) and add `omitClaudeMd: true`, `maxTurns`, `effort` to lean specialists.
3. S: run `/skill-doctor`, `/doctor prompt-audit`, `claude plugin validate --strict` in CI.
4. S: add `paths` to domain skills; migrate path-specific CLAUDE.md content to `.claude/rules/`.
5. M: adopt `claude plugin eval` for skill-trigger and gate regression cases.
6. M: use `PostToolBatch`/`PostCompact`/`StopFailure`/`TaskCompleted(exit 2)` hooks to replace custom burst/cadence detection.
7. M: `isolation: worktree` for parallel builders; fix CLAUDE_PROJECT_DIR vs `cwd` handling in hooks/state for native worktrees.
8. M: scheduled tasks for nightly hygiene (validators, backlog-drift, cost report).
9. L: prototype plugin `workflows/` for slice pipeline and parallel review/validate fan-out.
10. L: replace hand-rolled cost capture with native OTel attribution (keep slice mapping); evaluate SDK-based headless walker.
11. Ignore for now: Agent Teams (experimental, interactive-only), Managed Agents, channels, themes, LSP/monitors (unless loop watcher wanted).

## Unverified / gaps
- Release dates for versions other than 2.1.314-2.1.318 (changelog is undated; GitHub releases API response too large to page).
- Contents of hooks doc after char 200,000 (TeammateIdle, TaskCreated, `if` field exact schema) and skills doc final eval section.
- Gateway cost endpoint and Managed Agents `multiagent_20261001`: CHANGELOG line only.
- gstack: not in official marketplace.json as read; may be absent or in the unread tail (file was read to its end per the fetch, but descriptions were summarized).
- Anthropic engineering blog posts not searched (WebSearch not used; official docs and repos were sufficient and fetchable).
