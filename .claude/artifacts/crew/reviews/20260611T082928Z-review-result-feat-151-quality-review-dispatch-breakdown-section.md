---
findings: "🔴:0,🟡:2,❓:1"
---
# Review Result: FEAT-151 quality review — dispatch breakdown section

- Created: 2026-06-11T08:29:28.184Z
- Reviewer: reviewer
- Decision: approved_with_notes
- Summary: All CI gates green, aggregator edge cases well-handled, env-gating correct; two medium findings (unbounded readFile, duplicate helper) and one low finding (unsafe runId cast) warrant follow-up but do not block merge.
- Evidence Checked:
  - bun test (11 unit + 8 CLI integration = 19 pass
  - 0 fail); bun run lint (0 warnings); bun run typecheck (clean); manual diff review of all 7 changed files; secrets scan (clean); sort-stability analysis; WorkflowRun interface inspection (no runId field confirmed)
- Files Reviewed:
  - scripts/lib/dispatch-timing-reader.ts
  - scripts/lib/artifacts/types.ts
  - scripts/lib/artifacts/write.ts
  - scripts/lib/cost-hygiene/cost-slice-handler.ts
  - scripts/lib/cost-hygiene/emit-cost-report.ts
  - tests/dispatch-timing-reader.test.ts
  - tests/cli-synthesis-cost.test.ts
- Test Adequacy: 11 unit tests cover aggregateDispatchTiming (empty log, missing runId, multi-run filter, token sort), aggregateBashGates (empty, timeout detection, per-gate sum), renderDispatchBreakdownSection (empty both, section header, bash-only, missing toolCalls); 2 CLI integration tests cover section-appears with seeded rows and CREW_COST_REPORT_DISPATCH_DETAIL=0 suppression; Skills column render asserted; all 19 pass.
- Risks: Unbounded fs.readFile on long-lived JSONL logs could cause OOM on busy repos; WorkflowRun cast hides a latent miss when runId is never written to state.
- Required Follow-up: MEDIUM: add a file-size cap (e.g. stat + 10MB guard) before readFile in aggregateDispatchTiming and aggregateBashGates; MEDIUM: extract collectDispatchBreakdown to a shared helper in dispatch-timing-reader.ts to eliminate the near-duplicate in cost-slice-handler vs emit-cost-report; LOW: add runId to WorkflowRun interface in workflow-state-gates.ts and remove the double-cast (or add a follow-up FEAT); LOW: document the three env vars in CHANGELOG or README.

