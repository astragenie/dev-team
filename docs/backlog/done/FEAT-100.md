---
id: FEAT-100
title: "TS migration Phase 0 — foundation (tsconfig strict, Result/ids/schemas, Node 22, baseline)"
priority: P1
status: done
category: code-quality
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md
plan: docs/superpowers/plans/2026-06-07-ts-migration-phase-0-foundation.md
related: [FEAT-101, FEAT-102, FEAT-103, FEAT-104, FEAT-105]
phase: null
tags: ["concern:code-quality", "surface:tooling", "stack:typescript", "stack:node"]
pm_customer_impact: 0.5
pm_demand_signal: null
pm_technical_feasibility: null
pm_scope_risk: null
pm_strategic_alignment: 0.5
pm_composite: null
pm_legacy_demand_signal: null
pm_legacy_customer_impact: null
pm_effort_estimate: 0.5
pm_technical_risk: 0.5
pm_dependency_depth: 0.5
migration_note: legacy PM schema preserved as pm_legacy_*; new dimensions defaulted to 0.5 on 2026-06-07
triage_notes: "autonomous_safe inferred: AC count=12, derived_from=null → true"
updated: 2026-06-07
started_at: 2026-06-07
slices: [SLICE-16]
slices_complete: [SLICE-16]
completed_at: 2026-06-07
---
# FEAT-100 — TS migration Phase 0: foundation

## Why

User initiated a gradual cleanup + standards-conformance program tracked in the parent spec. Phase 0 establishes the tooling foundation so subsequent leaf-up migration slices have:

- `tsconfig.json` in strict mode for new `.ts` files (existing `.mjs` keeps loose checking so cross-ext imports survive).
- A `Result<T, E>` module + branded id types + a Zod schema module — the type/error-model floor every later slice imports from.
- Node 22.6+ minimum (strip-types runtime).
- A baseline-metrics doc so every subsequent slice can measure deltas.

No `.mjs` is renamed in this slice. Phase 1+ does the actual leaf migrations.

`autonomous_safe: true` — no agent prompt edits, no skill authoring; tooling + 3 small TS modules + doc updates.

## Spec

`docs/superpowers/specs/2026-06-07-ts-migration-and-perf-design.md` § Phase 0.

## Plan

`docs/superpowers/plans/2026-06-07-ts-migration-phase-0-foundation.md` — 12 tasks, bite-sized TDD steps.

## Acceptance criteria

- [ ] AC-1: `zod ^3` in `package.json` devDependencies; lockfile updated.
- [ ] AC-2: `tsconfig.json` has `strict: true, noUncheckedIndexedAccess: true, exactOptionalPropertyTypes: true, noUnusedLocals: true, noUnusedParameters: true, useUnknownInCatchVariables: true, checkJs: false`. `include` widened to `["scripts/**/*.ts", "scripts/**/*.mjs", "tests/**/*.ts", "hooks/**/*.ts"]`. `exclude` only `["node_modules"]`.
- [ ] AC-3: `scripts/lib/result.ts` exports `Result<T,E>`, `ok`, `err`, `map`, `flatMap`. Tested in `tests/result.test.ts` (≥4 cases).
- [ ] AC-4: `scripts/lib/ids.ts` exports branded types + constructors for `RepoPath`, `SliceId`, `FeatId`, `ArtifactPath`, `CostReportPath`, `BadgeName`. Tested in `tests/ids.test.ts`.
- [ ] AC-5: `scripts/lib/schemas.ts` exports `WorkflowStateSchema` (zod). Tested with happy + invalid fixtures + live-file parse in `tests/schemas.test.ts` (≥3 cases).
- [ ] AC-6: `npm test` script invokes `node --test --experimental-strip-types`; runs both `.mjs` and `.ts` tests successfully.
- [ ] AC-7: `scripts/validate-typegraph.mjs` exists, exits 0 on PASS, prints `validate-typegraph: PASS` when typecheck clean. Wired as `validate:typegraph` npm script.
- [ ] AC-8: `.github/workflows/test.yml` uses Node 22; adds advisory `validate:typegraph` step with `continue-on-error: true` immediately after the `typecheck` step.
- [ ] AC-9: `scripts/e2e-smoke.mjs` and `scripts/e2e-smoke-ux.mjs` pass `--experimental-strip-types` to every spawned `node` invocation.
- [ ] AC-10: `README.md` + `CLAUDE.md` both state minimum Node 22.6+ requirement.
- [ ] AC-11: `docs/architecture/ts-migration-baseline.md` exists with current LoC (`.mjs` only), ESLint problem count, brief-me p50/p95 cold + warm timings (5 runs each), and `.ts` file count.
- [ ] AC-12: All existing CI gates green locally: `npm ci`, `validate-manifests`, `validate-skills`, `validate-agents`, `validate-slices`, `npm run lint`, `npm run format:check`, `npm run typecheck`, `npm test`, `e2e:smoke`, `e2e:smoke:ux`.

## Notes

- Strip-types flag is `--experimental-strip-types` (Node 22 LTS). Pin Node 22 in CI. Fallback to `tsx` loader documented in spec risk register if strip-types regresses upstream.
- `@typescript-eslint` plugin deferred to Phase 1 (see plan's self-review note — Phase 0 ships ≤80 lines of new TS where `tsc --noEmit` already covers what lint would catch).
