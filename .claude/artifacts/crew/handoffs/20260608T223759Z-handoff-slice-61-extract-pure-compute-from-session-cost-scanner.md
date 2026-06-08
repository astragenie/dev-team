# Task Handoff: SLICE-61: extract pure compute from session-cost-scanner

- Created: 2026-06-08T22:37:59.780Z
- From: builder
- To: lead
- Objective: Extracted all pure computation functions from scripts/lib/session-cost-scanner.ts into scripts/lib/session-cost-scanner/compute.ts; parent file is now a thin I/O wrapper re-exporting everything.
- Allowed Scope:
  - session-cost-scanner.ts refactor + new compute.ts + new unit test file
- Forbidden Scope: -
- Deliverable: compute.ts with 12 pure functions, session-cost-scanner.ts as I/O wrapper, 38-test unit suite all green
- Changed Files:
  - scripts/lib/session-cost-scanner.ts
  - scripts/lib/session-cost-scanner/compute.ts
  - tests/session-cost-scanner-compute.test.ts
- Confidence: high
- Risks: none
- Suggested Next Handoff: none

