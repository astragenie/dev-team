---
id: PM-REVIEW-FEAT-197
feature: FEAT-197
reviewed_at: 2026-07-08
pm_customer_impact: 0.6
pm_effort_estimate: 0.55
pm_strategic_alignment: 0.75
pm_technical_risk: 0.45
pm_dependency_depth: 0.3
composite_priority: P2
autonomous_safe: false
---
# PM Review — FEAT-197

## Demand Assessment

- **Evidence:** Lessons digest (bun ../runner-plugin/src/scripts/loop.mts lessons recent 5), SLICE-86 surprise: 'Runner CLI did NOT auto-promote FEAT-160 to done/ this time (unlike SLICE-84/85 close where FEAT-159 got auto-moved). May be because FEAT-160's status was already in-progress (vs triaged) when slice complete fired. Worth confirming the heuristic next time.' -- concrete evidence of an unresolved ceremony-state ambiguity this e2e would have caught.

## Scope Challenge

- **Scope notes:** Smallest deliverable: drive slice start -> build -> review -> validate -> close against the sample/temp repo used by e2e-smoke.ts and assert only the 4 named outcomes (artifacts land, currentRun rotates, cost attribution attaches, file moves to completed) -- cut build/review/validate to a stubbed pass-through if forced to halve, keeping only start+close state transitions. Partial overlap found: scripts/e2e-smoke.ts (391 lines, read on disk) already asserts workflow-state.currentRun shape at lines 306-321, but nothing about the full build->review->validate->close chain, cost attribution, or the slice-file-move-to-completed step -- net-new coverage, not a duplicate. AC clarity: FEAT body is descriptive prose only, no Given-When-Then criteria present -- autonomous_safe:false per the vague-AC rule (this is P2, so PM does not draft ACs inline per the priority-gating table; a human or a --deep rerun should size the AC set before slicing). Effort analog: qa-expert test-quality-lens aggregate (20260613T192005Z, $112.83 across 4 sessions, cross-subsystem test-tooling work) is the closest shape -- multi-subsystem test-infra work, actual cost ran higher than a single-file change; supports effort 0.55 (bumped from a naive single-file guess) rather than assuming it is as cheap as FEAT-196.

## Scores

- customer_impact: 0.60
- effort_estimate: 0.55
- strategic_alignment: 0.75
- technical_risk: 0.45
- dependency_depth: 0.30

## Priority Derivation

composite_priority: P2
autonomous_safe: false
reasoning: technical_risk 0.45, band 0.3-0.5 (new e2e pattern in repo -- orchestrating the full ceremony has no existing analog -- but test-only, no schema/contract change, clean git revert). composite_score=0.615; neither P1 branch fires (impact 0.60 < 0.7; alignment 0.75 < 0.8) -> P2. autonomous_safe=false: no explicit AC in the FEAT body (P2, no --deep/--spec passed, so PM does not draft AC this pass) -- AC-clarity gate trips regardless of numeric scores.

## Risks

- Blast radius spans slice-linker/dispatch, cost aggregation, workflow-state, and artifact writers -- a flaky multi-step e2e across that many subsystems risks being disabled/skipped under CI time pressure rather than fixed, which would defeat its purpose.
- Dispatching real subagents inside an e2e run (to exercise build/review/validate) could be costly and slow per run; if the FEAT is sliced without deciding to mock those steps, effort could run well above the 0.55 estimate.
- Weak grade dimensions test_confidence (0.548) and reliability (0.526) are directly the target of this FEAT -- but until AC are drafted, there is no criterion holding the implementation to those dimensions, which is why autonomous_safe stays false until AC exist.
