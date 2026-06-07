# Task Handoff: SLICE-39 review: rejected — AC-5 + AC-7 violations

- Created: 2026-06-07T14:06:19.408Z
- From: reviewer
- To: lead
- Objective: SLICE-39 rejected: emit-cost-report.ts never unwraps Result<T,E> from writeArtifact (AC-5 violation producing wrong-shape artifact values), and two functions exceed the 30-line AC-7 limit.
- Allowed Scope:
  - Independent review of SLICE-39 (FEAT-115) TS Phase 2.2 — artifacts
  - deployment-guidance
  - outcome-linkage migration to TypeScript
- Forbidden Scope: -
- Deliverable: Review-result artifact at .claude/artifacts/crew/reviews/20260607T140609Z-review-result-slice-39-artifacts-linkage-ts-migration.md; decision: rejected
- Changed Files:
  - scripts/lib/artifacts/read.ts
  - scripts/lib/artifacts/write.ts
  - scripts/lib/artifacts/types.ts
  - scripts/lib/outcome-linkage.ts
  - scripts/lib/deployment-guidance/read.ts
  - scripts/lib/deployment-guidance/write.ts
  - scripts/lib/cost-hygiene/emit-cost-report.ts
  - scripts/crew.mjs
- Confidence: high
- Risks: emit-cost-report.ts Result non-unwrap is a silent wrong-shape bug not caught by current tests; AC-7 violations are minor but non-compliant
- Suggested Next Handoff: Builder must fix emit-cost-report.ts Result unwrapping and add a test for the returned shape; optionally split buildRepoLayoutBlock and collectOutcomeLinkage to honor AC-7. Re-review required.

