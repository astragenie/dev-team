---
findings: "🔴:0,🟡:1,❓:0"
---
# Review Result: FEAT-151 spec compliance review — per-dispatch breakdown section

- Created: 2026-06-11T08:24:25.068Z
- Reviewer: reviewer
- Decision: approved_with_notes
- Summary: Spec is substantially implemented: aggregator, writer, toggle, and tests all present and passing; one narrow gap — skill-load count per agent is captured in the data model but not rendered in the Markdown output.
- Evidence Checked:
  - aggregateDispatchTiming(logPath
  - runId) exported at dispatch-timing-reader.ts:54; BashGateAggregate exported at dispatch-timing-reader.ts:80; DispatchBreakdown interface in types.ts:52; section appended after renderCostReportByModel in write.ts:629; toggle checked in renderCostReportDispatchBreakdown and collectDispatchBreakdown; 19/19 tests pass including CLI section-appears and DETAIL=0 suppression tests; 7 files changed
  - no agent prompts or FEAT-149/150 files touched beyond expected integration points.
- Files Reviewed:
  - scripts/lib/dispatch-timing-reader.ts
  - scripts/lib/artifacts/types.ts
  - scripts/lib/artifacts/write.ts
  - scripts/lib/cost-hygiene/cost-slice-handler.ts
  - scripts/lib/cost-hygiene/emit-cost-report.ts
  - tests/dispatch-timing-reader.test.ts
  - tests/cli-synthesis-cost.test.ts
- Test Adequacy: 11 unit tests (aggregateDispatchTiming, aggregateBashGates, renderDispatchBreakdownSection) plus 2 CLI integration tests covering section-appears and CREW_COST_REPORT_DISPATCH_DETAIL=0 suppression; all 19 pass.
- Risks: Skill-load count is captured in DispatchRow.skillLoadCount but not exposed in any rendered table column; operators reading the cost-report cannot see per-agent skill-load data.
- Required Follow-up: Builder should add a Skills column to renderDispatchTable in dispatch-timing-reader.ts:165 to surface skillLoadCount in rendered Markdown, then add a test assertion on the value.

