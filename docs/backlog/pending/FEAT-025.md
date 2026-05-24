---
id: FEAT-025
title: Enable noImplicitAny in tsconfig and annotate all scripts/**/*.mjs
priority: P3
status: pending
category: types
target_release: null
autonomous_safe: true
parent_spec: null
---

# FEAT-025 — Enable noImplicitAny in tsconfig

## Why

LSP flags implicit-any warnings as errors (×) that `tsc --noEmit` silently accepts (tsconfig has `noImplicitAny: false`). This produces recurring diagnostic noise every turn in the IDE. Enabling the flag aligns LSP and tsc so both agree on what constitutes an error.

## Scope

- tsconfig.json: `noImplicitAny: false` → `true`
- Add JSDoc `@param` / `@type` annotations to all 29 files under `scripts/**/*.mjs`
- ~808 errors to resolve (measured 2026-05-24 with `npx tsc --noEmit --noImplicitAny`)
- Use specific types where obvious (repoPath→string, label→string); `any` where genuinely polymorphic
- Runtime behavior unchanged — annotations are comments only

## Estimate

- Largest files: workflow-state.mjs (142), crew.mjs (142), session-cost.mjs (80)
- Approach: one builder dispatch per ~5-file batch to stay under maxTurns
- Estimated 3-4 builder dispatches or one marathon session

## Acceptance criteria

- [ ] AC-1: `npx tsc --noEmit` exits 0 with `noImplicitAny: true` in tsconfig
- [ ] AC-2: no `// @ts-ignore` or `// @ts-expect-error` annotations used
- [ ] AC-3: full CI suite passes (71+ tests, lint, format, typecheck, all validators)
- [ ] AC-4: no runtime behavior change (annotations are JSDoc comments only)

## Risks

- Mistyped annotations (e.g. `@param {string}` on a value that can be null) may mask real bugs. Mitigation: full test suite unchanged = behavior preserved.
- 29-file diff is large for review. Mitigation: changes are mechanical, diff is add-only (JSDoc above existing functions).

## Prior attempt

Builder dispatched 2026-05-24 ran out of turns at 42/40 (maxTurns). Completed ~30% of files before pausing. Partial work was reverted to keep tsconfig consistent.
