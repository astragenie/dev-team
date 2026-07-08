---
id: FEAT-200
status: triaged
priority: P2
category: feature
target_release: null
created: 2026-07-08
updated: 2026-07-08
depends_on: []
slices: []
derived_from: null
pm_customer_impact: 0.55
pm_effort_estimate: 0.35
pm_strategic_alignment: 0.5
pm_technical_risk: 0.45
pm_dependency_depth: 0.25
pm_composite_priority: P2
pm_autonomous_safe: false
pm_reviewed: 2026-07-08
autonomous_safe: false
triage_notes: "technical_risk 0.45, band 0.3-0.5 (new-to-repo sharding pattern, single CI workflow file, no data/schema change, clean revert). composite_score=0.565; neither P1 branch fires (impact 0.55 < 0.7; alignment 0.50 < 0.8) -> P2. autonomous_safe=false: no AC in the bare-prose FEAT body (P2, no --deep/--spec) trips the AC-clarity gate, and this directly edits .github/workflows/test.yml (CI-touching convention, same as FEAT-190's autonomous_safe:false precedent)."
---
## Description

Shard the test suite — split bun test by file-glob across N CI jobs to cut wall-clock. bun test runs single-process (no --parallel, bun#5090) so 1715 tests are slow every cycle and discourage local runs. Faster CI enables more stabilization iterations. Keep bun#5090 note; re-enable --parallel when fixed upstream.

## Acceptance criteria

_Sole owner of `.github/workflows/test.yml` in the parallel wave. Files: `test.yml`, `package.json`, `scripts/test-shard.ts`, `tests/test-shard*.test.ts`._

- AC-1: Given the suite runs single-process (`bun test`, no `--parallel`, bun#5090), When CI runs, Then `bun run test` is split across N sharded matrix jobs via a deterministic file-glob partition (`scripts/test-shard.ts` + a `test:shard` package.json script taking shard index/total), each shard running a disjoint subset of `tests/`.
- AC-2: Given the partition, When all N shards are unioned, Then every test file runs exactly once (no file skipped, no file double-run) — asserted by a `tests/test-shard*.test.ts` coverage test over the partition function.
- AC-3: Given the sharded matrix in `test.yml`, When it lands, Then the validators step (lines 15-33) and `node ./scripts/e2e-smoke.ts` (line 40) still run EXACTLY ONCE (not per-shard); only the `bun run test` step (line 38) is sharded. (Preserve every existing step — additive restructure of one step only.)
- AC-4: Given a failing test in any shard, When CI runs, Then that shard's job fails red (the gate still blocks merges), and the test-phase wall-clock drops materially vs the single-process baseline (record before/after in the PR).

## Intake notes

Created via free-text intake (`/runner:intake "<text>"`). Priority is
unset — this FEAT has not been scored yet. Run `/runner:triage`
(PM scoring + `backlog pm-apply`) to score it before slicing.