---
id: PM-REVIEW-FEAT-201
feature: FEAT-201
reviewed_at: 2026-07-08
pm_customer_impact: 0.65
pm_effort_estimate: 0.25
pm_strategic_alignment: 0.7
pm_technical_risk: 0.3
pm_dependency_depth: 0.3
composite_priority: P2
autonomous_safe: false
---
# PM Review — FEAT-201

## Demand Assessment

- **Evidence:** FEAT body + own memory (dualwrite-drift-reconcile-pattern.md): 'best-effort SoT + durable derived-duplicate needs explicit reconcile/backfill (FEAT-188 S5 drift-check.ts); recall must full-window scan not tail-read 64KB.' Confirmed on disk: scripts/lib/memory/drift-check.ts exists (102 lines) -- this FEAT wires an already-built check into a gate rather than building new detection logic from scratch. loop-snapshot.md confirms FEAT-188 (the memory-capture/recall feature this drift-check belongs to) is the current in-flight P1.

## Scope Challenge

- **Scope notes:** Smallest deliverable: wire the existing drift-check.ts into a scheduled job (lower blast radius than a blocking PR gate) with a threshold, plus the single e2e asserting dualWrite:true on both stores; cut the e2e if forced to halve, since the scheduled drift-check alone already surfaces silent drift. No overlap found: nothing else in the pending/in-progress backlog wires drift-check.ts into CI or a schedule today. Effort analog: 20260613T195716Z hash-drift CI-gate pilot slice ($76.18, 1 session, 26 min) is a near-exact shape match -- an existing detection script wired into a CI/scheduled gate -- confirms effort 0.25.

## Scores

- customer_impact: 0.65
- effort_estimate: 0.25
- strategic_alignment: 0.70
- technical_risk: 0.30
- dependency_depth: 0.30

## Priority Derivation

composite_priority: P2
autonomous_safe: false
reasoning: technical_risk 0.30, band 0.3-0.5 (extends an existing, already-merged script (drift-check.ts) into a new CI/scheduled step -- new wiring pattern but no schema change, clean revert). composite_score=0.6925; neither P1 branch fires (impact 0.65 < 0.7; alignment 0.70 < 0.8) -> P2. autonomous_safe=false: no AC in the bare-prose FEAT body (P2, no --deep/--spec) trips the AC-clarity gate, and this wires into CI-or-scheduled-job config (CI-touching convention).

## Risks

- astramem writes are fire-and-forget by design (per FEAT body); a drift-check threshold set too loose could let real drift through silently, while too tight could false-positive on normal async-write latency -- the FEAT as written does not yet specify the threshold value or its basis.
- Depends on FEAT-188 remaining stable while still in-progress (loop-snapshot.md: FEAT-188 slices S1a/S1b/S2/S3a/S3b/S4/S5/S6, S3b upcoming per runner#368) -- wiring a gate against a moving in-flight feature risks the gate needing rework once S3b lands.
- Touches CI-or-scheduled-job configuration to wire the gate -- same CI-touching convention that keeps this autonomous_safe:false until a human confirms the schedule/threshold choice.
