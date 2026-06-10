# Task Handoff: WS1 Tasks 5+6: Split approvals and artifacts test families

- Created: 2026-06-10T13:51:28.405Z
- From: builder
- To: lead
- Objective: Successfully split approvals (1 test) and artifacts (9 tests) families from cli.test.ts into separate in-process test files using runCrew() pattern.
- Status: completed
- Allowed Scope:
  - tests/cli-approvals.test.ts (new)
  - tests/cli-artifacts.test.ts (new)
  - tests/cli.test.ts (modified)
- Forbidden Scope: -
- Deliverable: Two new test files with in-process runCrew() pattern; removed 10 tests from cli.test.ts; both commits created and pushed
- Changed Files:
  - tests/cli-approvals.test.ts
  - tests/cli-artifacts.test.ts
  - tests/cli.test.ts
- Confidence: high
- Risks: none
- Suggested Next Handoff: WS1 T7: Split synthesis and cost tests into cli-synthesis-cost.test.ts

