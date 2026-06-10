---
id: SLICE-10
feature: FEAT-033
title: Tool-failure preflight hook for Bash + PowerShell
status: completed
priority: P1
autonomous_safe: true
created: 2026-06-02
completed_at: 2026-06-02
updated: 2026-06-02
github_issue: 46
github_url: "https://github.com/sergeymilashico/hero-crew/issues/46"
---
# SLICE-10: Tool-failure preflight hook for Bash + PowerShell

- **Priority**: P1
- **Status**: Pending
- **Author**: herolegion
- **Created**: 2026-06-02
- **Parent Feature**: FEAT-033

## Objective

Add a PreToolUse hook on the `Bash` and `PowerShell` tool matchers that
runs a cheap, fast preflight on the command string and emits a soft-warn
`systemMessage` when a preventable failure mode is detected. Never blocks
the tool call. Reduces the 3.4–4.4% tool-failure rate visible in recent
cost reports by warning before the agent submits a doomed call.

## Why now

- Cost reports show 49 tool failures per SLICE-08 (3.6%) and 101 per
  earlier slice (4.4%). Each failure burns tokens on the failed call +
  the error + the retry.
- `feedback_cost_discipline.md` rule #5 already documents the four
  failure modes most worth catching: wrong shell env-var syntax, missing
  cwd, deleted directory in chained `cd <path> && ...`, Windows path
  quote / escape issues.
- Additive, no agent-prompt edits required → `autonomous_safe: true`.
- Independent of FEAT-029 dogfood (which is deferred). Does not edit
  the cost-hygiene reread hook scripts.

## In scope

- New hook script: `hooks/preflight-shell.mjs`. PreToolUse, gated by
  `CREW_TOOL_PREFLIGHT !== "0"` (default ON; opt-out via `=0`).
- New pure check library: `scripts/lib/preflight/checks.mjs`, exporting
  one function per failure mode plus a `runChecks(input)` aggregator.
  Pure functions, no I/O except optional `fs.stat` calls inside the
  cwd-existence and chained-cd checks.
- Wire two PreToolUse matchers in `hooks/hooks.json`: `Bash` and
  `PowerShell`. Each invokes `node "${CLAUDE_PLUGIN_ROOT}/hooks/preflight-shell.mjs"`.
- Soft-warn output: hook writes `{ "decision": "approve", "systemMessage": "..." }`
  to stdout. Never `decision: "block"`. On parse failure or check
  exception, exit 0 silently.
- Checks (v1, the four highest-yield):
  1. **env-var shape mismatch**: input `tool_name === "PowerShell"` and
     command contains a bare `$NAME` (uppercase, not preceded by `env:`
     or `$(`) → warn "use `$env:NAME` in PowerShell, not `$NAME`".
     Mirror: `tool_name === "Bash"` and command contains `$env:NAME` →
     warn "bash does not understand `$env:NAME`, use `$NAME`".
  2. **chained-cd path missing**: scan command for `cd <path> &&` or
     `cd <path>;` prefixes (and PowerShell `Set-Location <path>`). For
     each captured `<path>`, resolve against `cwd` and `fs.stat`. If
     ENOENT → warn naming the missing path.
  3. **windows path quote / escape mistakes**: detect a Windows-style
     path (matches `[A-Za-z]:\\` or `[A-Za-z]:/`) embedded **unquoted**
     in a chained command where the path contains a space. Warn to
     quote the path.
  4. **bash here-doc unterminated**: command contains `<<'EOF'` or
     `<<EOF` but no matching `EOF` on its own line. Warn `here-doc
     terminator missing`.
- New test file: `tests/preflight-shell.test.mjs`. Covers:
  - synthetic command per failure mode triggers exactly one warn
  - clean command produces no output (silent)
  - `CREW_TOOL_PREFLIGHT=0` short-circuits — no output regardless of
    command
  - malformed JSON on stdin → exit 0, no output
  - missing `tool_input.command` → exit 0, no output
- README / CHANGELOG update mentioning the new hook + opt-out flag.

## Out of scope

- Editing `hooks/check-redundant-read.mjs` or `hooks/record-read-content.mjs`
  (cost-hygiene reread hook — owned by FEAT-029 / SLICE-09).
- Editing any agent prompts (`agents/builder.md`, `agents/reviewer.md`,
  `agents/lead.md`). FEAT-030 / FEAT-031 territory.
- New check categories beyond the four listed above. Extensibility hooks
  exist in the design but no v2 checks land in this slice.
- Telemetry / counting how often each check fires. Useful later, not
  this slice.
- A v0.4.0 release tag — version bump lives in the commit but tag +
  push are user-triggered per `CLAUDE.md` Release workflow.

## Acceptance criteria

Each criterion must be testable with evidence per
`01-loop-control/EVIDENCE_RULES.md`.

- [ ] AC-1: `hooks/preflight-shell.mjs` exists and reads JSON from
      stdin matching the Claude Code PreToolUse hook contract
      (`session_id`, `cwd`, `tool_name`, `tool_input.command`).
      Evidence: file present + parses stdin shape per existing
      `hooks/check-redundant-read.mjs:parseInput` pattern.
- [ ] AC-2: `scripts/lib/preflight/checks.mjs` exports four pure-ish
      check functions + a `runChecks({ toolName, command, cwd })`
      aggregator returning `{ warnings: string[] }`. Evidence: module
      shape + node-test assertions per failure mode.
- [ ] AC-3: `hooks/hooks.json` wires two new PreToolUse matchers
      (`Bash`, `PowerShell`) pointing at `preflight-shell.mjs`.
      Evidence: file diff; `scripts/validate-manifests.mjs` passes.
- [ ] AC-4: Hook emits `{ decision: "approve", systemMessage: "<warn>" }`
      stdout on detected failure mode, with exit code 0. Never
      `decision: "block"`. Evidence: synthetic stdin in tests asserting
      stdout shape.
- [ ] AC-5: Opt-out `CREW_TOOL_PREFLIGHT=0` short-circuits the hook
      (exit 0, no stdout). Evidence: env-set test in
      `tests/preflight-shell.test.mjs`.
- [ ] AC-6: Default behavior is hook ON — no env var required.
      Evidence: env-unset test in `tests/preflight-shell.test.mjs`.
- [ ] AC-7: Failure mode 1 (env-var shape mismatch) — synthetic
      command `echo $env:HOME` with `tool_name: "Bash"` triggers
      warn naming `$env:` syntax. Mirror `echo $HOME` with
      `tool_name: "PowerShell"` triggers warn naming `$NAME` vs
      `$env:NAME`. Evidence: two assertions in test file.
- [ ] AC-8: Failure mode 2 (chained-cd missing path) — command
      `cd C:/no/such/path && ls` triggers warn naming the missing
      path. Evidence: test creates a non-existent path, asserts
      warn fires and warn text contains the path.
- [ ] AC-9: Failure mode 3 (unquoted Windows path with space) —
      command `cd C:/work mega/hero-crew && ls` triggers warn.
      Clean variant `cd "C:/work mega/hero-crew" && ls` does not.
      Evidence: two assertions.
- [ ] AC-10: Failure mode 4 (unterminated here-doc) — command
      `bash -c "cat <<'EOF'\nhello"` triggers warn. Properly
      terminated variant does not. Evidence: two assertions.
- [ ] AC-11: Clean command (no failure mode present) produces zero
      stdout and exits 0. Evidence: silent-case test in test file.
- [ ] AC-12: Hook never raises an unhandled exception. All file
      operations (`fs.stat` on cwd / chained paths) wrapped in
      try/catch. On any exception, exit 0 silently and append a
      best-effort entry to `.claude/logs/events.jsonl` with
      `event: preflight-shell:<code>`. Evidence: test asserts
      `fs.stat` throwing does not propagate.
- [ ] AC-13: All 8 CI gates green:
      `npm ci` → `validate-manifests` → `validate-skills` →
      `validate-slices` → `npm run lint` (zero warnings) →
      `npm run format:check` → `npm run typecheck` → `node --test`
      (including new `tests/preflight-shell.test.mjs`) →
      `node ./scripts/e2e-smoke.mjs`. Evidence: green local run +
      origin/main CI status.
- [ ] AC-14: `CHANGELOG.md` entry under v0.4.0 (or next minor)
      noting the new preflight hook, the four v1 checks, and the
      `CREW_TOOL_PREFLIGHT=0` opt-out. Evidence: file diff.

## Done When

- all acceptance criteria above are PASS with evidence
- build passes per `.claude/loop.json` `stack.build`
- tests pass per `.claude/loop.json` `stack.test`
- Crew `review-result` artifact written with `Test Adequacy` field
  populated
- Crew `final-synthesis` artifact written
- entry appended to `../backlog/completed-slices.md`
- this slice file moved from `slices/pending/` → `slices/completed/`
- FEAT-033 moves from `docs/backlog/in-progress/` to `docs/backlog/done/`

## Reviewer ladder

- Reviewer A: code review — hook script, pure-check library,
  `hooks.json` wiring, tests. Particularly: confirm no `decision: "block"`
  path exists, confirm all I/O wrapped in try/catch, confirm regex
  patterns for env-var detection don't false-positive on
  `${var:-default}` shell expansion or `$()` command substitution.
- Reviewer B: behavior / integration review — exercise the hook
  against real Bash + PowerShell tool calls in this session (or
  fixtures simulating same), confirm warn output appears in agent
  context and does NOT prevent execution.

## Risks

- **Regex false positives** on env-var shape check. Bash variables
  with curly braces (`${HOME}`), positional args (`$1`), or arithmetic
  expansions (`$((1+1))`) must not trigger the PowerShell-shape warn.
  Mitigation: lock regex to `\$[A-Z_][A-Z0-9_]*` and explicitly
  exclude `${` and `$(` lookbehinds.
- **`fs.stat` on non-cwd paths** could leak file existence info to a
  hostile cwd. Acceptable here — the hook only stats paths the agent
  is already about to `cd` to; agent already controls cwd.
- **Slow startup** — hook runs on every Bash/PowerShell call. Target
  < 30 ms wall time. If slower, drop chained-cd check (the only
  I/O-bearing check) to async-best-effort or reduce regex passes.
  Mitigation: latency assertion in test using `performance.now()`.
- **Tool name discovery** — confirm the actual tool-name strings
  Claude Code uses for Bash vs PowerShell in PreToolUse payloads
  before finalizing matcher regex. Investigation first task of slice.

## Resolved during slice open (2026-06-02)

- **Hook contract** mirrors `hooks/check-redundant-read.mjs:parseInput`
  shape. Reuses session_id + cwd + tool_input fields.
- **Default-on with opt-out** policy aligns with FEAT-033 spec; does
  NOT conflict with the FEAT-029 deferred work (different env var,
  different hook).
- **Plugin root**: hook entry uses `${CLAUDE_PLUGIN_ROOT}` per existing
  `hooks/hooks.json` convention.

## Open questions

- Should the v0.4.0 bump live in the same commit as the hook code,
  or be a separate release-prep commit? Default: separate commit
  for the version bump so `git log` reads cleanly.
- Should `CREW_TOOL_PREFLIGHT` also accept `disabled` / `off` as
  aliases for `0`? Default: no — single canonical opt-out value
  matches the `CREW_COST_HYGIENE` convention.
