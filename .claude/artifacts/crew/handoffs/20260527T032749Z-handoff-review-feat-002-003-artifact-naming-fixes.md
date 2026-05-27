# Task Handoff: Review: FEAT-002+003 artifact naming fixes

- Created: 2026-05-27T03:27:49.700Z
- From: reviewer
- To: lead
- Objective: Changes approved with notes — FEAT-002 double-prefix fix and FEAT-003 ordering fix are both correct, but the new slice param in buildOptionalFrontmatter is dead code that needs resolution before the feature is complete.
- Allowed Scope:
  - scripts/crew.mjs
  - scripts/lib/artifacts.mjs
  - tests/cli.test.mjs — correctness
  - regressions
  - test adequacy
  - scope discipline
- Forbidden Scope: -
- Deliverable: Review-result artifact written; decision: approved_with_notes
- Changed Files:
  - scripts/crew.mjs
  - scripts/lib/artifacts.mjs
  - tests/cli.test.mjs
- Confidence: high
- Risks: Dead slice param in buildOptionalFrontmatter at crew.mjs line 299 — caller still passes two args, --slice not in parseArgs, no test coverage; stale JSDoc on line 275
- Suggested Next Handoff: Builder: wire --slice into parseArgs + writeCostAdviseArtifact options + call at line 299, or drop the param; update JSDoc

