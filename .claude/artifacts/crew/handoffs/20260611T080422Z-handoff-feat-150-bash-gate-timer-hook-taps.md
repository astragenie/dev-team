# Task Handoff: FEAT-150: Bash gate timer + hook taps

- Created: 2026-06-11T08:04:22.527Z
- From: builder
- To: lead
- Objective: New bash-gate-timer lib + PreToolUse/PostToolUse Bash hook taps wire per-gate JSONL telemetry into the Phase 1 baseline pipeline
- Allowed Scope: -
- Forbidden Scope: -
- Deliverable: -
- Changed Files:
  - scripts/lib/bash-gate-timer.ts
  - tests/bash-gate-timer.test.ts
  - hooks/lib/bash-gate-timer-tap.ts
  - hooks/pre-tool-use-bash-gate.ts
  - hooks/post-tool-use-bash-gate.ts
  - hooks/hooks.json
- Confidence: high
- Risks: 1 pre-existing test failure out of scope (projects-root-override timeout). Hook taps are fire-and-forget additive; no behavior change to existing Bash gate execution.
- Suggested Next Handoff: -

