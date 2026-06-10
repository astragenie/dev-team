---
id: SLICE-67
title: "Hook-core extraction: in-process testable hooks (kill per-test node spawns)"
status: pending
feature: FEAT-146
phase: null
priority: P2
target_release: null
requires_validation: true
created: 2026-06-10
updated: 2026-06-10
---
# SLICE-67: Hook-core extraction: in-process testable hooks (kill per-test node spawns)

Implements FEAT-146. See [feature file](../../../backlog/in-progress/FEAT-146.md) for product context.

## Objective

The 4 per-tool hooks (check-redundant-read, check-subagent-return, record-read-content, preflight-shell) are only testable by spawning a fresh node --experimental-strip-types process per test (~120 spawn-based tests across preflight-shell / subagent-return / cost-hygiene-hook suites, ~0.3-0.6s per spawn on Windows). Post-WS1 (suite 115.9s -> 21.1s) these spawn tests are the largest remaining wall-clock lever.

## In scope

- Extract each of the 4 hook flows into `hooks/lib/<name>.ts` exporting a unified core signature: `run<Name>Hook(raw: string, env: NodeJS.ProcessEnv): Promise<string | null>`
- Move `logEvent`, `parseInput`, and related domain functions verbatim from hook entry files into their respective lib files (imports adjusted to `../../scripts/...`)
- Reduce hook entry files (`hooks/preflight-shell.ts`, `hooks/check-subagent-return.ts`, `hooks/check-redundant-read.ts`, `hooks/record-read-content.ts`) to thin shims: env gate → read stdin → call core → write non-null stdout; exit semantics byte-identical
- Convert spawn-based tests in-process via `runHook` helper swap (import core, call directly, keep all assertions unchanged)
- Retain 1–2 spawn-based smoke tests per hook file to validate runtime-contract integrity (env-truly-unset paths and happy-path proof)
- Keep `tests/hook-feature-gating.test.ts` fully spawn-based (unchanged; runtime-contract proof)
- Remove mid-flow `process.exit(0)` calls from `hooks/lib/record-read-content.ts` (replace with returns, exit only in shim; repo rule 6 compliance)
- Maintain all file I/O side effects (state persistence, event logging, fs stat reads) with real calls — tests pass `mkdtemp` cwd inside the payload

## Out of scope

- Behavioral changes to any hook (all side effects, stderr handling, exit codes must match current behavior)
- Modifications to `tests/hook-feature-gating.test.ts` (stays spawn-based as the bridge test)
- The loop repo's SLICE_TEMPLATE
- WP1, WP3, WP4 work (other workpackages; separate slices)

## Acceptance criteria

- [ ] AC-1: Hook runtime contract unchanged — `tests/hook-feature-gating.test.ts` passes with zero modifications (`git diff --stat main -- tests/hook-feature-gating.test.ts` outputs empty)
- [ ] AC-2: Smoke tests remain spawn-based and green — `bun test --parallel tests/preflight-shell.test.ts tests/subagent-return.test.ts tests/cost-hygiene-hook.test.ts 2>&1 | grep -E "^tests/ .* pass"` shows all files passing
- [ ] AC-3: Spawn-based tests reduced from ~120 to a few retained smokes — measured by spawn call-sites (NOT total `test(` count): `grep -c "runHookSpawn(" tests/preflight-shell.test.ts tests/subagent-return.test.ts tests/cost-hygiene-hook.test.ts` ≤ ~3 per file (1 helper def + ≤2 smoke calls); every other test converted to in-process `runHook`
- [ ] AC-4: No `process.exit()` or `process.exit(0)` present in any `hooks/lib/*.ts` file — `grep -r "process\.exit" hooks/lib/ | wc -l` outputs 0
- [ ] AC-5: Full linting and type-checking pass — `bun run lint` and `bun run typecheck` both exit 0
- [ ] AC-6: Full test suite passes under parallel bun execution — `bun test --parallel --timeout 30000 tests/` exits 0 with 577 pass, 0 fail

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-146 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: `requires_validation: false` in frontmatter — no validation gate required)

## Reviewer ladder

- Reviewer A: Hook-core extraction integrity — verify `hooks/lib/` cores maintain exact parsing/flow logic, verify entry shims preserve byte-identical stdout + exit-code semantics, check feature gates work in both entry and core, confirm no `process.exit` in lib code
- Reviewer B: Test-conversion correctness — confirm in-process `runHook` helper swaps preserve all assertions unchanged, verify spawn-smoke paths (truly-unset env, warn-path) are retained and functional, check that merged/removed tests are provably duplicate and documented in handoff
