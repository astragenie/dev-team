---
id: FEAT-150
status: pending
priority: P2
category: observability
target_release: null
created: 2026-06-11
updated: 2026-06-11
depends_on: []
slices: []
derived_from: docs/superpowers/specs/2026-06-11-slice-perf-2x-3x-design.md
autonomous_safe: true
tags: [perf, observability, telemetry]
---
# FEAT-150: Bash gate timer helper

## Description

Phase 1 of the 2-3x slice speedup spec. Tiny PreToolUse/PostToolUse
hook tap on the Bash tool. Logs `{gate, durationMs, exitCode}` per
matching gate invocation (lint, format:check, typecheck, test, audit,
validate:all, npm ci). Writes to `.claude/logs/bash-gates.jsonl`
(gitignored).

Feeds the cost-report breakdown section (FEAT-151) and the post-Phase-2
"hang frequency" success metric (count of `"TIMEOUT"` rows).

Pure additive. Non-blocking.

## Acceptance hints

- `scripts/lib/bash-gate-timer.ts` exports `classifyBashGate`,
  `startGateTimer`, `endGateTimer`.
- `classifyBashGate("bun run typecheck")` returns `"typecheck"`.
- `classifyBashGate("ls -la")` returns `null`.
- PreToolUse tap calls `startGateTimer`; PostToolUse calls
  `endGateTimer`. Handle stashed in module-level Map keyed by event-id.
- Unit test confirms row shape + classifier behavior.

## Notes

Spec section 1b. Plan Task 2.
