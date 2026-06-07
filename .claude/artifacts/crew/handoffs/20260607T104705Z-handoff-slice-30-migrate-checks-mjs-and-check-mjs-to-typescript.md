# Task Handoff: SLICE-30: Migrate checks.mjs and check.mjs to TypeScript

- Created: 2026-06-07T10:47:05.578Z
- From: builder
- To: lead
- Objective: Migrated 2 leaf modules from .mjs to .ts with full TypeScript types, deleted originals, updated 3 caller import paths; all gates green.
- Allowed Scope:
  - scripts/lib/preflight/checks.mjs→checks.ts
  - scripts/lib/subagent-return/check.mjs→check.ts
  - 3 caller import paths
- Forbidden Scope: -
- Deliverable: 2 new .ts files, 2 deleted .mjs files, 3 updated import paths; typecheck/lint/format/test all pass
- Changed Files:
  - scripts/lib/preflight/checks.ts
  - scripts/lib/subagent-return/check.ts
  - hooks/preflight-shell.mjs
  - hooks/check-subagent-return.mjs
  - tests/subagent-return.test.mjs
- Confidence: high
- Risks: none
- Suggested Next Handoff: none

