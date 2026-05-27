# Task Handoff: lazy imports in scripts/crew.mjs

- Created: 2026-05-27T04:47:05.402Z
- From: builder
- To: lead
- Objective: Replaced 14 static top-level imports with per-handler dynamic imports in scripts/crew.mjs to reduce CLI startup time
- Allowed Scope:
  - scripts/crew.mjs only — pure refactor
  - no behavior change
- Forbidden Scope: -
- Deliverable: scripts/crew.mjs with all lib imports deferred to handler bodies via await import()
- Changed Files:
  - scripts/crew.mjs
- Confidence: high
- Risks: none
- Suggested Next Handoff: none

