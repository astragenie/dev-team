# Task Handoff: SLICE-32: Migrate 3 cost-hygiene modules from .mjs to .ts

- Created: 2026-06-07T10:58:31.359Z
- From: builder
- To: lead
- Objective: Migrated state.mjs, decide.mjs, and render-frontmatter.mjs to TypeScript with real interfaces, updated all 5 callers (3 hooks/scripts + 2 test files), all 433 tests pass.
- Allowed Scope:
  - scripts/lib/cost-hygiene/state.ts
  - decide.ts
  - render-frontmatter.ts; callers: scripts/lib/artifacts.mjs
  - hooks/check-redundant-read.mjs
  - hooks/record-read-content.mjs
  - tests/cost-hygiene-decide.test.mjs
  - tests/cost-hygiene-state.test.mjs
- Forbidden Scope: -
- Deliverable: 3 .ts files replacing .mjs originals; 5 caller import paths updated; all gates green
- Changed Files:
  - scripts/lib/cost-hygiene/state.ts
  - scripts/lib/cost-hygiene/decide.ts
  - scripts/lib/cost-hygiene/render-frontmatter.ts
  - scripts/lib/artifacts.mjs
  - hooks/check-redundant-read.mjs
  - hooks/record-read-content.mjs
  - tests/cost-hygiene-decide.test.mjs
  - tests/cost-hygiene-state.test.mjs
- Confidence: high
- Risks: none
- Suggested Next Handoff: none

