---
id: SLICE-85
title: "FEAT-159 SLICE-B — Cost-report agent-stats section + regex fix"
status: pending
feature: FEAT-159
phase: null
priority: P2
target_release: null
requires_validation: true
risk: medium
autonomous_safe: true
developer_type: inline
estimated_complexity: small
created: 2026-06-20
updated: 2026-06-20
depends_on: [SLICE-84]
touches_files: [scripts/lib/artifacts/types.ts, scripts/lib/artifacts/write.ts, scripts/lib/cost-hygiene/emit-cost-report.ts, scripts/lib/agent-stats-aggregator.ts, tests/cost-report-agent-stats-section.test.ts, docs/observability/agent-stats.md]
touches_files_confidence: declared
file_line_budgets:
  scripts/lib/artifacts/types.ts: 130
  scripts/lib/artifacts/write.ts: 870
  scripts/lib/cost-hygiene/emit-cost-report.ts: 230
  scripts/lib/agent-stats-aggregator.ts: 250
  tests/cost-report-agent-stats-section.test.ts: 200
  docs/observability/agent-stats.md: 130
---
# SLICE-85 — FEAT-159 Part B: cost-report agent-stats section + regex fix

Appends an `## Agent stats (rolling)` section to per-slice cost reports, using the aggregator + writer shipped in SLICE-84. Bundles the inspector's LOW advisory from SLICE-84 review: extend the rework-decision regex from `/needs.?fix/i` to `/(needs.?fix|rejected)/i` so real `rejected` review decisions count toward `review_rework_rate`.

## In scope

1. Edit aggregator regex (`decisionSet` line 188): `/(needs.?fix|rejected)/i`.
2. Add `agentStats?` field on `ArtifactFields`.
3. Add `renderCostReportAgentStats(rows)` to `write.ts`, wire into `renderCostReportBody` AFTER `renderCostReportDispatchBreakdown`. Section header `## Agent stats (rolling)`; table top-5 by `sample_count` desc.
4. Edit `emit-cost-report.ts`: call `aggregateAgentStats` with `last_n_slices:env.CREW_AGENT_STATS_WINDOW ?? 10`, pass through `agentStats` field. Gate via `CREW_COST_REPORT_AGENT_STATS=0` (mirrors existing `CREW_COST_REPORT_DISPATCH_DETAIL=0` env at line 16).
5. New test file with 4 cases (see ACs).
6. Update doc note: "cost report embeds; lead still NOT wired".

## Out of scope

- Lead consumption — separate slice, `autonomous_safe: false`.
- New CLI surfaces (already exist from SLICE-84).
- Schema migration of old cost reports (new section absent in old reports; retrospective aggregators read frontmatter, not body).

## Acceptance criteria

- [ ] AC-1: `bun run typecheck` clean.
- [ ] AC-2: `bun test tests/cost-report-agent-stats-section.test.ts` — 4/4 PASS.
- [ ] AC-3: `bun test tests/agent-stats-aggregator.test.ts` — 7/7 still PASS.
- [ ] AC-4: file LOC budgets met (validate via `wc -l`).
- [ ] AC-5: `git diff --stat` shows ONLY the 6 touches_files.
- [ ] AC-6: live cost-report smoke — trigger `maybeEmitCostReport` via slice-complete on a no-op slice OR by directly calling the function via CLI smoke; confirm latest `cost-report-slice` artifact contains `## Agent stats (rolling)` header (or correctly absent when no telemetry data).
- [ ] AC-7: env gate smoke — set `CREW_COST_REPORT_AGENT_STATS=0`, re-trigger, confirm section absent.

## Done When

- all ACs PASS
- commit pushed
- FEAT-159 stays in in-progress/ (SLICE-C remains)

## Reviewer ladder

- Reviewer A: `crew:inspector` — backwards-compat of cost-report body (new section appended last), env gate respected, try/catch on aggregator call doesn't mask real bugs.
- (Skip Reviewer B — SLICE-84 already validated `AgentStatsRow` contract; this slice consumes it as-is.)
- Validator: `crew:verifier` — runs AC-6 + AC-7 live smokes.
