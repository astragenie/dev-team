---
id: FEAT-033
title: Tool-failure preflight hook
priority: P1
status: in-progress
category: performance
target_release: v0.4.0
created: 2026-06-01
updated: 2026-06-02
depends_on: []
slices: [SLICE-10]
derived_from: null
autonomous_safe: true
---

## Description

Recent cost reports show a 3.4–4.4% tool failure rate per slice. Most
failures are trivial preventables: wrong shell syntax (`$VAR` vs
`$env:VAR`), missing cwd, deleted directories, malformed paths. Each
failure wastes tokens on the call + the error + the retry.
Cost-discipline rule #5 already documents this. Add a PreToolUse hook
that runs a cheap precheck on Bash and PowerShell chained commands
and emits a soft-warn when a preventable failure mode is detected.

## Acceptance hints

- PreToolUse hook on `Bash` and `PowerShell` tools.
- Soft-warn only; never block. Output appears in the agent's context
  alongside the tool call.
- Checks (extensible): cwd reference points to an existing directory;
  env-var reference shape matches the active shell (`$env:NAME` in
  PowerShell, `$NAME` in bash); chained `cd <path> && ...` paths
  exist; obvious quote / escape mistakes on Windows paths.
- Configurable via env var (e.g., `CREW_TOOL_PREFLIGHT=0` to
  disable).
- Tests: hook warns on synthetic failure-mode command, stays silent
  on clean command.
- Subsequent cost reports show measurably lower tool failure rate.

## Notes

- Additive, no agent-prompt change required.
- Source analysis: handoff `20260601T115349Z-...-awaiting-user-choice.md`.
