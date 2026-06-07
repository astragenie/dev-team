# Task Handoff: AC-7 fix: split all 8 oversized functions in cost-advisor TS files

- Created: 2026-06-07T14:28:12.155Z
- From: builder
- To: lead
- Objective: Extracted 14 private helpers across 3 files to bring all 8 oversized function bodies to ≤30 lines with zero behavior change.
- Allowed Scope:
  - scripts/lib/cost-advisor.ts
  - scripts/lib/session-cost.ts
  - scripts/lib/cost-advisor-grades.ts — function body splitting only
- Forbidden Scope: -
- Deliverable: All 8 AC-7-violating functions now have bodies ≤30 lines; 14 private helpers extracted; no exports added or removed; no behavior changed
- Changed Files:
  - scripts/lib/cost-advisor.ts
  - scripts/lib/session-cost.ts
  - scripts/lib/cost-advisor-grades.ts
- Confidence: high
- Risks: none
- Suggested Next Handoff: none

