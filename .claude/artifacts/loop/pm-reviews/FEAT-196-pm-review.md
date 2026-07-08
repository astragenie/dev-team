---
id: PM-REVIEW-FEAT-196
feature: FEAT-196
reviewed_at: 2026-07-08
pm_customer_impact: 0.7
pm_effort_estimate: 0.2
pm_strategic_alignment: 0.7
pm_technical_risk: 0.15
pm_dependency_depth: 0.15
composite_priority: P1
autonomous_safe: true
---
# PM Review — FEAT-196

## Demand Assessment

- **Evidence:** Task context: 'runner#368 is about to build S3b against the frozen recall-injection-v1 contract that FEAT-196 guards.' Named, imminent cross-repo consumer (runner-plugin#368) building against a contract this repo froze via FEAT-188. loop-snapshot.md confirms FEAT-188 is the current in-flight P1.

## Scope Challenge

- **Scope notes:** Smallest deliverable: two assertions added to the existing scripts/e2e-smoke.ts (391 lines, read on disk) -- provider:none byte-identical dispatch, provider:file single-entry exactly-one-inject. Cut-to-half: keep only the provider:none baseline assertion if forced, since a silent double-inject is the worse failure mode and the no-recall path is the fastest regression signal for runner#368. No overlap found: e2e-smoke.ts today asserts workflow-state currentRun shape (lines 306-321) but nothing about recall-injection contract. Effort analog: 20260613T195716Z-cost-report-slice-pre-rendered-universals-render-script-hash-drift-ci-gate-pil.md ($76.18, 1 session, 26 min, single-script extension with a CI-gate shape) -- same shape (extend an existing script with a new assertion), confirms effort 0.20-0.25 band; used 0.20. Weak grade dimensions (loop-snapshot.md, all 7 averages <0.80): observability 0.496 and test_confidence 0.548 are most relevant to a test-infra FEAT; reliability 0.526 also relevant. AC-3 and AC-4 below target observability (structured log event) and test_confidence (blocking non-zero exit) respectively so autonomous_safe:true is justified per the weak-dimension AC-coverage rule.

## Scores

- customer_impact: 0.70
- effort_estimate: 0.20
- strategic_alignment: 0.70
- technical_risk: 0.15
- dependency_depth: 0.15

## Priority Derivation

composite_priority: P1
autonomous_safe: true
reasoning: technical_risk 0.15 band 0.0-0.2 (known e2e-smoke.ts pattern, single file, trivial git revert). composite_score=0.7425 -> P1 via (impact>=0.7 AND alignment>=0.6). autonomous_safe=true: no numeric gate tripped (risk/effort/dep all <=0.6), only edits a script CI already invokes (not the workflow YAML itself), and ACs below cover the weak observability/test_confidence dimensions.

## Risks

- Pre-mortem Q1 (failed review in 2 weeks): most likely cause is the new assertions being written against a stubbed/mocked recall provider instead of the real dispatch path, so 'byte-identical' passes trivially without exercising the actual merge logic where injection happens -- reviewer must confirm the smoke drives the real CLI dispatch, not a unit-level stub.
- Pre-mortem Q2 (rollback if merged and broke the loop): revert-only. This is a test-only diff to scripts/e2e-smoke.ts; git revert of that commit fully restores prior behavior, no migration or state cleanup needed.
- Pre-mortem Q3 (coverage gap): existing recall-provider unit tests exercise the provider in isolation and would not catch a regression in the dispatch-time merge/injection glue code -- that gap is exactly what AC-1/AC-2 close.
