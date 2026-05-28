# Task Handoff: Task 3 spec compliance review complete — rejected

- Created: 2026-05-28T20:27:11.645Z
- From: reviewer
- To: lead
- Objective: Spec compliance review of hooks/check-redundant-read.mjs (commit 2de0f4d) is REJECTED on 2 findings: recordRead called with 5 args vs spec's 4-arg signature, and evictLRU (an internal function) called directly from the hook.
- Allowed Scope:
  - Spec compliance only against docs/superpowers/specs/2026-05-28-cost-hygiene-reread-hook-design.md — 11-point checklist covering env-var gate
  - input contract
  - path resolution
  - stat handling
  - decide() integration
  - output protocol
  - state persistence
  - never-block cardinal rule
  - logging
  - test scenarios
  - and scope discipline.
- Forbidden Scope: -
- Deliverable: Review result artifact at .claude/artifacts/crew/reviews/20260528T202659Z-review-result-task-3-spec-compliance-review-check-redundant-read-mjs.md. Decision: REJECTED.
- Changed Files:
  - hooks/check-redundant-read.mjs
  - tests/cost-hygiene-hook.test.mjs
- Confidence: high
- Risks: recordRead arity mismatch may be silent at runtime if state.mjs ignores the extra arg — the bug could go undetected until state.mjs enforces its signature; evictLRU direct call couples hook to an internal, making state.mjs refactors break the hook.
- Suggested Next Handoff: Builder fixes: (1) drop the 5th 'nowIso' arg from recordRead call; (2) verify whether evictLRU is exported from state.mjs public surface — if not, remove the direct call and let saveSession/recordRead handle LRU internally. Then route back to reviewer for re-review.

