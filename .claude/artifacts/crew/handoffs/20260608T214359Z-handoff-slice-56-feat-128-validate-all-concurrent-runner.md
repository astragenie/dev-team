# Task Handoff: SLICE-56 FEAT-128: validate-all concurrent runner

- Created: 2026-06-08T21:43:59.760Z
- From: builder
- To: lead
- Objective: New scripts/validate-all.ts runs 4 validators concurrently; npm run validate:all exits 0 on clean repo
- Allowed Scope:
  - scripts/validate-all.ts (new)
  - package.json scripts section (validate:all added)
- Forbidden Scope: -
- Deliverable: validate:all npm script — concurrent runner, fail-fast with all failures printed; 2 new tests in tests/validate-all.test.ts
- Changed Files:
  - scripts/validate-all.ts
  - package.json
  - tests/validate-all.test.ts
- Confidence: high
- Risks: none
- Suggested Next Handoff: crew:reviewer

