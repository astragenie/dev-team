# Task Handoff: WS1 Task 4: Extract fixtures and split claims tests

- Created: 2026-06-10T13:25:09.660Z
- From: builder
- To: lead
- Objective: Extracted cli-fixtures helper and split 3 claims tests to runCrew in-process; all gates pass
- Status: completed
- Allowed Scope:
  - tests/helpers/cli-fixtures.ts (new)
  - tests/cli-claims.test.ts (new)
  - tests/cli.test.ts (updated - removed 3 tests + duplicate loadState
  - added helper import)
- Forbidden Scope: -
- Deliverable: tests/helpers/cli-fixtures.ts with execFile, cliPath, makeTempDir, loadState exports; tests/cli-claims.test.ts with 3 converted tests using runCrew(); tests/cli.test.ts updated with fixture imports (30 tests remain)
- Changed Files:
  - tests/cli-claims.test.ts
  - tests/cli.test.ts
  - tests/helpers/cli-fixtures.ts
- Confidence: high
- Risks: none
- Suggested Next Handoff: Task 5: split cli-approvals.test.ts (1 test)

