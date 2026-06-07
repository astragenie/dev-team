# Task Handoff: SLICE-35 review complete — rejected, AC-3 and AC-6 unmet

- Created: 2026-06-07T11:41:18.213Z
- From: reviewer
- To: lead
- Objective: SLICE-35 rejected: two exported public functions lack explicit return types (AC-3) and six functions exceed the 30-line SRP split requirement (AC-6); all other gates pass including tsc, lint, format, and 433/433 tests.
- Allowed Scope:
  - Independent review of briefing/collect.ts and briefing.ts TS migration; caller import correctness; test file updates
- Forbidden Scope: -
- Deliverable: Review result artifact at .claude/artifacts/crew/reviews/20260607T114108Z-review-result-slice-35-review-briefing-collect-briefing-ts-migration.md — decision: rejected
- Changed Files:
  - scripts/lib/briefing/collect.ts
  - scripts/lib/briefing.ts
  - scripts/lib/wakeup.mjs
  - scripts/crew.mjs
  - tests/brief-me-hook-health.test.mjs
  - tests/briefing-cost-health.test.mjs
  - tests/briefing-cost-rollup-dedupe.test.mjs
  - tests/collect-hook-health.test.mjs
  - tests/collect-model-compliance.test.mjs
  - tests/cost-report-role-breakdown.test.mjs
- Confidence: high
- Risks: collectRecentCosts two-branch return union is runtime-safe but invisible to callers; buildBriefingReport opaque inference chain propagates to crew.mjs
- Suggested Next Handoff: crew:fix — apply the 6 required changes listed in the review result, then re-review

