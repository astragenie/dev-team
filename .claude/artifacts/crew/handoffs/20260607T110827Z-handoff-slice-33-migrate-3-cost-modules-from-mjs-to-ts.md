# Task Handoff: SLICE-33: Migrate 3 cost modules from .mjs to .ts

- Created: 2026-06-07T11:08:27.853Z
- From: builder
- To: lead
- Objective: Migrated emit-cost-report, cost-slice-handler, and session-cost-scanner from .mjs to .ts with full type coverage; updated 2 callers; all 433 tests pass.
- Allowed Scope:
  - scripts/lib/cost-hygiene/emit-cost-report.{mjs->ts}
  - scripts/lib/cost-hygiene/cost-slice-handler.{mjs->ts}
  - scripts/lib/session-cost-scanner.{mjs->ts}
  - plus caller import updates in scripts/crew.mjs and scripts/lib/session-cost.mjs
- Forbidden Scope: -
- Deliverable: Three .ts modules replacing three .mjs files; zero .mjs originals remain; callers updated; typecheck/lint/format/tests all green.
- Changed Files:
  - scripts/lib/cost-hygiene/emit-cost-report.ts
  - scripts/lib/cost-hygiene/cost-slice-handler.ts
  - scripts/lib/session-cost-scanner.ts
  - scripts/crew.mjs
  - scripts/lib/session-cost.mjs
- Confidence: high
- Risks: Dynamic imports from .mjs files required permissive casts on writeArtifact/computeSessionCost to avoid JSDoc-to-TS type mismatches; logic is identical to original.
- Suggested Next Handoff: Continue FEAT-109 migration: next batch of .mjs files per SLICE-34 or whatever the lead designates.

