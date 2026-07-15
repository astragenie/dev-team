# Task Handoff: Scope tracker-provider Phase 5 two-way sync gap

- Created: 2026-07-12T22:57:03.380Z
- From: researcher
- To: dispatcher
- Objective: Phase 5's two-way-sync dependency was never scoped; recommend BUILD-REDUCED — status-only escalation on top of Phase 4.5, not a general sync engine, with grades/cost excluded from the tracker entirely.
- Allowed Scope:
  - Read-only scoping of the tracker-provider transition plan's Phase 5 gap: source-of-truth
  - conflict model
  - entity verdicts
  - minimal slice
  - cost/benefit. No code changes.
- Forbidden Scope: -
- Deliverable: FEAT-204 spec at .claude/artifacts/loop/backlog/pending/FEAT-two-way-tracker-sync.md with acceptance criteria and explicit BUILD-REDUCED recommendation.
- Changed Files:
  - .claude/artifacts/loop/backlog/pending/FEAT-two-way-tracker-sync.md
- Confidence: high
- Risks: Recommendation depends on trusted baseline facts supplied by the dispatcher (TaskStoreProvider shape, FEAT-245 scope, Phase 4.5 in-flight status) rather than fresh re-verification, per the task's own budget constraint. Open question on notification channel for the acknowledgment gate is unresolved and needs human input.
- Suggested Next Handoff: Human/dispatcher review of FEAT-204's BUILD-REDUCED recommendation before any slice is derived; if accepted, update the transition plan's Phase 5 section to point at FEAT-204 instead of the unscoped dependency.

