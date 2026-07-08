---
id: PM-REVIEW-FEAT-200
feature: FEAT-200
reviewed_at: 2026-07-08
pm_customer_impact: 0.55
pm_effort_estimate: 0.35
pm_strategic_alignment: 0.5
pm_technical_risk: 0.45
pm_dependency_depth: 0.25
composite_priority: P2
autonomous_safe: false
---
# PM Review — FEAT-200

## Demand Assessment

- **Evidence:** FEAT body + repo CLAUDE.md: 'bun test single-process, no --parallel (bun#5090) -> slow suite'; CLAUDE.md's own local-commands section documents the same constraint verbatim ('No --parallel -- removed in a20f9dd9 to work around Bun's node:test single-process scheduling bug (bun#5090)'). Frequency: every CI run and every local `bun run test` invocation -- daily, not an edge case -- but this is a velocity/DX improvement, not a correctness-blocking defect, so it does not reach the same customer_impact band as FEAT-196/198/199.

## Scope Challenge

- **Scope notes:** Smallest deliverable: split by file-glob across 2 CI jobs first (not N), prove the sharding boundary has zero test overlap/omission, before expanding to more shards. Cut-to-half: 2-shard split only, skip result-aggregation tooling if forced to halve (rely on CI's native per-job pass/fail). No overlap with FEAT-198 (OS matrix) or FEAT-190 (runtime migration) found -- this is orthogonal (splits the existing single-OS job's test glob, does not add an OS). Effort analog: no close cost analog found for test-sharding specifically; closest shape is the hash-drift CI-gate pilot ($76.18, single session) for the CI-wiring mechanics, but sharding also requires proving shard-boundary correctness (no test silently dropped) which that analog does not cover -- noting 'no direct cost analog' and keeping effort at the dimension-table default 0.35.

## Scores

- customer_impact: 0.55
- effort_estimate: 0.35
- strategic_alignment: 0.50
- technical_risk: 0.45
- dependency_depth: 0.25

## Priority Derivation

composite_priority: P2
autonomous_safe: false
reasoning: technical_risk 0.45, band 0.3-0.5 (new-to-repo sharding pattern, single CI workflow file, no data/schema change, clean revert). composite_score=0.565; neither P1 branch fires (impact 0.55 < 0.7; alignment 0.50 < 0.8) -> P2. autonomous_safe=false: no AC in the bare-prose FEAT body (P2, no --deep/--spec) trips the AC-clarity gate, and this directly edits .github/workflows/test.yml (CI-touching convention, same as FEAT-190's autonomous_safe:false precedent).

## Risks

- Shard-boundary bugs (a test silently excluded from every shard) would reduce effective coverage while looking green -- the FEAT needs an explicit 'every test file assigned to exactly one shard' assertion, which is not called out in the current bare-prose FEAT body.
- bun#5090 (no --parallel) means sharding is a workaround bounded by an external upstream bug; if bun#5090 is fixed first, this FEAT's approach may need to be revisited (--parallel re-enabled) rather than layered on top.
- Touches .github/workflows/test.yml directly (the HARD CI gate file) -- any misconfigured job matrix risks breaking CI for every future PR until caught.
