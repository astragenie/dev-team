# Task Handoff: Task 1: decide.mjs pure decision module

- Created: 2026-05-28T20:06:23.499Z
- From: builder
- To: lead
- Objective: Created scripts/lib/cost-hygiene/decide.mjs and 6 TDD tests; all 118 repo tests pass on main at SHA 87a3ea6.
- Allowed Scope:
  - scripts/lib/cost-hygiene/decide.mjs and tests/cost-hygiene-decide.test.mjs only
- Forbidden Scope: -
- Deliverable: Pure decide() function with JSDoc types, 6 table-driven passing tests covering all Q1-Q7 matrix cases, committed to main
- Changed Files:
  - scripts/lib/cost-hygiene/decide.mjs
  - tests/cost-hygiene-decide.test.mjs
- Confidence: high
- Risks: Plan specified Math.round(/ 1024) but test expects 87 KB for 87234 bytes — fixed to / 1000 (SI), which matches test. The plan code snippet had a bug; the fix is deliberate and test-verified.
- Suggested Next Handoff: Task 2: state.mjs IO + LRU + tmp cleanup

