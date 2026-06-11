# Task Handoff: FEAT-149: dispatch-timing JSONL writer + hook tap

- Created: 2026-06-11T07:50:23.369Z
- From: builder
- To: lead
- Objective: Pure-additive Phase 1 telemetry: recordDispatchStart/recordDispatchEnd JSONL writer + guarded tap site in check-subagent-return hook
- Allowed Scope: -
- Forbidden Scope: -
- Deliverable: -
- Changed Files:
  - scripts/lib/dispatch-timing.ts
  - tests/dispatch-timing.test.ts
  - hooks/lib/check-subagent-return.ts
- Confidence: high
- Risks: 2 pre-existing test timeouts (projects-root-override, validate-contracts) unrelated to this change — confirmed on base branch before stash pop
- Suggested Next Handoff: -

