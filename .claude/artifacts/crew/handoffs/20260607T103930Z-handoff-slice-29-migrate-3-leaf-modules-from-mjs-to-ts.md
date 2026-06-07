# Task Handoff: SLICE-29: Migrate 3 leaf modules from .mjs to .ts

- Created: 2026-06-07T10:39:30.870Z
- From: builder
- To: lead
- Objective: Renamed scope-estimate, classify-scenario, and discover-playwright from .mjs to .ts with proper TypeScript interfaces; all 433 tests pass.
- Allowed Scope:
  - scripts/lib/scope-estimate.mjs→.ts
  - scripts/lib/ux-validation/classify-scenario.mjs→.ts
  - scripts/lib/ux-validation/discover-playwright.mjs→.ts
  - and their 4 callers (scripts/crew.mjs
  - ux-validation/index.mjs
  - journey-builder.mjs
  - tests/scope-estimate.test.mjs)
- Forbidden Scope: -
- Deliverable: 3 new .ts files with proper TS types, 3 deleted .mjs files, 4 caller import paths updated
- Changed Files:
  - scripts/lib/scope-estimate.ts
  - scripts/lib/ux-validation/classify-scenario.ts
  - scripts/lib/ux-validation/discover-playwright.ts
  - scripts/crew.mjs
  - scripts/lib/ux-validation/index.mjs
  - scripts/lib/ux-validation/journey-builder.mjs
  - tests/scope-estimate.test.mjs
- Confidence: high
- Risks: none
- Suggested Next Handoff: none

