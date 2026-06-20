---
feature: FEAT-159
status: active
---
# Run Brief: FEAT159 SLICE85: FEAT-159 SLICE-B — Cost-report agent-stats section + regex fix

- Created: 2026-06-20T09:08:16.904Z
- Tier: full
- Goal: -
- Mode: autonomous
- Pace: unattended
- Owner: loop
- Status: active
- Summary: -
- Scope:
  - 1. Edit aggregator regex (`decisionSet` line 188): `/(needs.?fix|rejected)/i`.
2. Add `agentStats?` field on `ArtifactFields`.
3. Add `renderCostReportAgentStats(rows)` to `write.ts`
  - wire into `renderCostReportBody` AFTER `renderCostReportDispatchBreakdown`. Section header `## Agent stats (rolling)`; table top-5 by `sample_count` desc.
4. Edit `emit-cost-report.ts`: call `aggregateAgentStats` with `last_n_slices:env.CREW_AGENT_STATS_WINDOW ?? 10`
  - pass through `agentStats` field. Gate via `CREW_COST_REPORT_AGENT_STATS=0` (mirrors existing `CREW_COST_REPORT_DISPATCH_DETAIL=0` env at line 16).
5. New test file with 4 cases (see ACs).
6. Update doc note: "cost report embeds; lead still NOT wired".
- Out Of Scope:
  - - Lead consumption — separate slice
  - `autonomous_safe: false`.
- New CLI surfaces (already exist from SLICE-84).
- Schema migration of old cost reports (new section absent in old reports; retrospective aggregators read frontmatter
  - not body).
- Planned Files: -
- Next Step: Begin implementation

