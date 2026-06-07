---
id: SLICE-16
status: pending
feature: FEAT-100
phase: null
priority: P1
target_release: null
requires_validation: true
created: 2026-06-07
updated: 2026-06-07
---
# SLICE-16: # FEAT-100 — TS migration Phase 0: foundation

Implements FEAT-100. See [feature file](../../../backlog/in-progress/FEAT-100.md) for product context.

## Objective

User initiated a gradual cleanup + standards-conformance program tracked in the parent spec. Phase 0 establishes the tooling foundation so subsequent leaf-up migration slices have:

## In scope

- bullet 1
- bullet 2

## Out of scope

- bullet 1

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

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-100 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
