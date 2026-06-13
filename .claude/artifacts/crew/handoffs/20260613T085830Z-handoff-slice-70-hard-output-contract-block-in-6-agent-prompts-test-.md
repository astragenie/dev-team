# Task Handoff: SLICE-70: HARD OUTPUT CONTRACT block in 6 agent prompts + test extension

- Created: 2026-06-13T08:58:30.012Z
- From: fullstack-dev
- To: lead
- Objective: Added HARD OUTPUT CONTRACT block to 6 specialist agents (architect, inspector-verifier, integrator, release-engineer, document-writer, refactor) and extended tests/agent-prompt-content.test.ts with 83 new assertions covering all 12 targeted agents; all AC-1 through AC-5 verified green.
- Allowed Scope: -
- Forbidden Scope: -
- Deliverable: -
- Changed Files:
  - agents/architect.md
  - agents/inspector-verifier.md
  - agents/integrator.md
  - agents/release-engineer.md
  - agents/document-writer.md
  - agents/refactor.md
  - tests/agent-prompt-content.test.ts
- Confidence: high
- Risks: pre-existing flaky bench: tests/log-event-async-bench.test.ts Windows p95 timing failure (300ms threshold, ~350-400ms actual) — unrelated to this SLICE; present before and after edits. agents/lead.md shows modified in git diff — this is a pre-existing change from before SLICE-70 work (confirmed: was M in initial git status, not touched by this slice).
- Suggested Next Handoff: SLICE-B (Prong B): add ## First action (stub artifact on entry) heading to 8 artifact-owning roles per FEAT-161 AC-6

