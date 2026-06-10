# Task Handoff: Task 6 — TDD red-phase tests for inlineLatestBundle

- Created: 2026-06-08T23:14:21.788Z
- From: builder
- To: lead
- Objective: Created 6 failing TDD tests for inlineLatestBundle that fail with ERR_MODULE_NOT_FOUND because inline.ts does not yet exist.
- Allowed Scope:
  - Create tests/build-bundle-inline.test.ts only; no implementation files touched.
- Forbidden Scope: -
- Deliverable: tests/build-bundle-inline.test.ts with 6 tests covering: header+body present, empty on no bundle, empty on unparseable frontmatter, empty on schema_version too high, alphabetical tiebreak, truncation warning.
- Changed Files:
  - tests/build-bundle-inline.test.ts
- Confidence: high
- Risks: none — red phase is intentional; inline.ts must be created by Task 7 to turn these green
- Suggested Next Handoff: Task 7: implement scripts/lib/build-bundle/inline.ts to make all 6 tests pass

