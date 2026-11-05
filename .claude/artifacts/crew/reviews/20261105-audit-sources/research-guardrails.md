# Research: hooks / guardrails (as of 2026-11-05)
Legend: V = fetched and verified; S = search snippet only; UNVERIFIED = not confirmed.

## Official Claude Code hooks (V) https://code.claude.com/docs/en/hooks
- 32 events incl. PostToolBatch (once per parallel batch, no matcher, can block loop), TaskCompleted, SubagentStop (agent_transcript_path, last_assistant_message; decision:block keeps subagent running), StopFailure, PreModelSwitch.
- Handler types: command, http, mcp_tool, prompt, agent (experimental). Optional args array.
- `if` field: ONE permission rule (e.g. Bash(git *)), tool events only, best-effort. Whether it avoids process spawn is UNVERIFIED.
- Matching hooks run in parallel; identical handlers across settings files dedupe (plugin copy does not).
- Timeouts: default 600s command. Timed-out PreToolUse does NOT block unless onFailure:"block" (default fail-open on timeout).
- async / asyncRewake (background; exit 2 wakes Claude). No daemon option.
- permissionDecision includes defer (non-interactive -p only).
- Stop hooks: since v2.1.143 turn ends with a warning after 8 consecutive blocks; env CLAUDE_CODE_STOP_HOOK_BLOCK_CAP (0 disables). V via https://github.com/anthropics/claude-code/issues/59583. stop_hook_active appears in hook input.

## Compiled single-binary dispatchers
1. cameronsjo/cadence-hooks https://github.com/cameronsjo/cadence-hooks (V)
   - Rust; Check trait returns Allow/Warn/Block; one binary, subcommand per check. README claims sub-ms cold start, no benchmark.
   - PR #1008 https://github.com/cameronsjo/cadence-hooks/pull/1008 (V): `group <ns>/<hook>...` runs several checks in ONE process, each on its own thread with panic guard, per-check disable env, audit rows. Any block => exit 2 reporting ALL blockers. A single check_plan table maps 61 subcommands so standalone and grouped paths cannot drift. Measured on 4-core Linux container: Write 12->2 processes, 14.6->6.0 ms wall, 45->11 ms CPU; Bash 6->3 processes, 8.2->4.9 ms wall. Single-check floor ~2.9 ms. Also removed git spawns by reading .git directly.
2. ticpu/ticpu-claude-command-hook https://github.com/ticpu/ticpu-claude-command-hook (V): one Rust binary, `install` writes PreToolUse Bash|Edit|Write and PostToolUse Edit|Write. Exit 0 normally, 1 on internal error = fail-open by design. Quote-aware shell splitter, table-driven verdict tests.
3. warxhead1/claude-hook-fast (Go) https://github.com/warxhead1/claude-hook-fast (S): ~3 ms avg, self-reported.
4. Crawford-Young/claude-config issue 78 https://github.com/Crawford-Young/claude-config/issues/78 (S): Node ~39-50 ms on Windows Git Bash; Rust 2-5 ms is an estimate. No Bun cold-start number found: UNVERIFIED.

## Completion / done verification
- nizos/tdd-guard https://github.com/nizos/tdd-guard (V): hooks block writes that skip tests; needs per-framework reporters; model-based validation. Successor nizos/probity https://github.com/nizos/probity (V): reads the agent session transcript directly (no reporters). Rules are deterministic (string/regex over commands/content) or AI-validated (costs an extra turn). Error behavior undocumented.
- Stop-hook blogs (S): run tests in Stop hook, exit 2 with output, guard on stop_hook_active. Critique: "ran tests" gate is not a correctness gate; needs diff check for deleted tests. https://skylos.dev/use-cases/claude-code-stop-hook , https://pilot-shell.com/blog/stop-hook-task-enforcement
- Official prompt-hook example returns {"ok":false,"reason":...} (S).

## Destructive-command guards, secrets, sandbox, policy
- kenryu42/claude-code-safety-net (npm cc-safety-net) https://github.com/kenryu42/claude-code-safety-net (S): PreToolUse parse of destructive git/fs commands, deny; `doctor` verifies hook wiring.
- Gitleaks as agent hook: JeongJaeSoon/agent-guard (S); CC Powerpack pre-push guide (S). Pattern: PreToolUse on git push/commit, exit 2. One skill fails open when no container runtime. Local hooks are bypassable (--no-verify), also run in CI.
- Sandbox: built-in (Seatbelt/bubblewrap) applies to Bash only, not built-in tools/MCP/hooks; native Windows unsupported. https://code.claude.com/docs/en/sandboxing (S). @anthropic-ai/sandbox-runtime wraps whole process (beta). Crew dev is on Windows, so unavailable natively.
- Gemini CLI policy engine https://geminicli.com/docs/reference/policy-engine/ (S): TOML rules, user/workspace/admin tiers, allow/deny/ask_user, deny_message, per-mode rules.
- Anthropic hookify https://github.com/anthropics/claude-plugins-official/tree/main/plugins/hookify (S; location disputed): rules as markdown files generated from conversation.
- Prompt injection: CloneGuard PostToolUse scanner (S): 100% recall but 43% false positives in independent eval, so unsuitable as a blocker.
- Not researched or UNVERIFIED: OpenAI Codex approval policy, Cursor/Copilot guardrails, disler/claude-code-hooks-mastery, rtk, e2b, Bun hook latency.

## Top 5 for crew
1. Single-process hook dispatcher (cadence `group` pattern). Effort M-L. Replace ~22 `bun script.ts` spawns with one `crew-hook <event>` entry importing checks as modules, run via Promise.all with per-check try/catch and timeout. Merge results: any block => exit 2 listing all blockers; nudges merged into one additionalContext. One check_plan table generates hooks.json. Measure with hyperfine on Windows before/after.
2. Use `if` and tighter matchers. Effort S. E.g. if: "Bash(git push*)" for pre-push verifier so non-matching calls never spawn. Verify by timing that `if` skips spawn (UNVERIFIED).
3. Stop/SubagentStop hardening. Effort S-M. Honor stop_hook_active and the 8-block cap: gate-guard should escalate to a recorded help_request after N blocks per agent_id (counter in .claude/state) instead of looping. Read SubagentStop agent_transcript_path and last_assistant_message so the DONE: check uses transcript evidence.
4. Evidence-based done check, Probity style. Effort M. Compare last test run (command + exit code) against last edit in transcript; flag deleted/skipped tests via git diff stat. Deterministic first; prompt hook only for ambiguity.
5. Fail-mode policy table plus `crew hooks doctor`. Effort S-M. Protective guards (secrets, destructive cmd, artifact-lock) fail closed on internal error with onFailure:"block"; telemetry (OTel, checkpoint cadence) fail open and async:true. Doctor verifies wiring and times each hook.
Runner-ups: PostToolBatch for one-shot context injection; gitleaks in pre-push verifier; `bun build --compile` dispatcher (startup gain on Windows UNVERIFIED) before considering Rust.
