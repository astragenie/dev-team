# Task Handoff: Fix SLICE-35 review failures: return types + function splits

- Created: 2026-06-07T11:46:12.769Z
- From: builder
- To: lead
- Objective: Added explicit return types to collectRecentCosts and buildBriefingReport, and split four oversized functions into smaller helpers to satisfy AC-3 and AC-6 reviewer requirements.
- Allowed Scope:
  - scripts/lib/briefing/collect.ts and scripts/lib/briefing.ts only
- Forbidden Scope: -
- Deliverable: RecentCostsResult interface added; collectRecentCosts annotated with Promise<RecentCostsResult>; buildBriefingReport annotated with Promise<Record<string, unknown>>; parseStatusCounts extracted from parseWorkingTree; resolveRunArtifacts extracted from collectRelevantArtifacts; buildSummary extracted from buildBriefingReport.
- Changed Files:
  - scripts/lib/briefing/collect.ts
  - scripts/lib/briefing.ts
- Confidence: high
- Risks: none
- Suggested Next Handoff: none

