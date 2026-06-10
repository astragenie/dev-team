---
id: FEAT-146
status: pending
priority: null
category: quality
target_release: null
created: 2026-06-10
updated: 2026-06-10
depends_on: []
slices: []
derived_from: null
---
# FEAT-146: Hook-core extraction: in-process testable hooks (kill per-test node spawns)

The 4 per-tool hooks (check-redundant-read, check-subagent-return, record-read-content, preflight-shell) are only testable by spawning a fresh node --experimental-strip-types process per test (~120 spawn-based tests across preflight-shell / subagent-return / cost-hygiene-hook suites, ~0.3-0.6s per spawn on Windows). Post-WS1 (suite 115.9s -> 21.1s) these spawn tests are the largest remaining wall-clock lever.

Sketch (full task-level detail exists in docs/superpowers/plans/2026-06-10-test-ci-wallclock-maintenance.md Tasks 5-9, authored pre-WS1 — re-baseline under bun test --parallel):
- Extract each hook's flow into hooks/lib/<name>.ts exporting a unified core: run<Name>Hook(raw: string, env: NodeJS.ProcessEnv) -> Promise<string | null> (return value = exact stdout payload or null). parseInput/extractBody/logEvent move verbatim; fs side effects stay real (tests pass mkdtemp cwd inside the payload).
- Hook entry files become thin shims: env gate -> read stdin -> call core -> write non-null output. Stdout hygiene + exit semantics byte-identical.
- Tests import cores in-process via a drop-in runHook helper swap (assertions unchanged); keep 1-2 spawn smokes per hook; tests/hook-feature-gating.test.ts stays fully spawn-based as the runtime-contract proof.
- Bonus: removes mid-flow process.exit(0) from record-read-content (repo rule 6 compliance).

Wins: largest remaining suite speedup; hooks become unit-testable by default (durable maintenance win — new hook behavior gets function-level tests).
AC: hook runtime contract unchanged (smoke + gating suites green); spawn-based test count reduced to smokes only; before/after timing recorded.