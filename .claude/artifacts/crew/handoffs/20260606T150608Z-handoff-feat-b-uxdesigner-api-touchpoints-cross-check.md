# Task Handoff: FEAT-B: uxdesigner API touchpoints + cross-check

- Created: 2026-06-06T15:06:08.767Z
- From: builder
- To: lead
- Objective: UX specs now mandate API touchpoints referencing OpenAPI operationIds; validator enforces it in CI
- Allowed Scope:
  - FEAT-B only — uxdesigner.md
  - Step 2 prompt
  - new validator + fixtures + CI step
- Forbidden Scope: -
- Deliverable: scripts/validate-ux-spec.mjs + fixtures + uxdesigner.md + orchestrate-slice Step 2 + CI step
- Changed Files:
  - scripts/validate-ux-spec.mjs
  - tests/validate-ux-spec.test.mjs
  - tests/fixtures/ux-specs/valid-ux-spec.md
  - tests/fixtures/ux-specs/missing-operationid.md
  - agents/uxdesigner.md
  - commands/orchestrate-slice.md
  - .github/workflows/test.yml
  - package.json
- Confidence: high
- Risks: none — additive section + new validator
- Suggested Next Handoff: FEAT-C/D can proceed (both depend only on FEAT-A; FEAT-B is parallel-safe)

