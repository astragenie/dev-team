# Task Handoff: WS1 Task 7: Split synthesis-cost tests to fixture-based in-process suite

- Created: 2026-06-10T14:18:29.977Z
- From: builder
- To: lead
- Objective: Converted six long-pole synthesis/cost tests from subprocess-based execFile to in-process runCrew under CREW_PROJECTS_ROOT fixture.
- Status: completed
- Allowed Scope:
  - tests/cli-synthesis-cost.test.ts (new)
  - tests/cli.test.ts (6 tests removed)
- Forbidden Scope: -
- Deliverable: New test file with 6 in-process tests + shared fixture; 6 tests removed from original cli.test.ts
- Changed Files:
  - tests/cli-synthesis-cost.test.ts
  - tests/cli.test.ts
- Confidence: high
- Risks: none
- Suggested Next Handoff: SLICE-88: WS1 T7b (cli-workflow.test.ts)

