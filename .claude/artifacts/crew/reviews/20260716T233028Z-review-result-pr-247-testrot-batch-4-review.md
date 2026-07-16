---
kind: review-result
title: PR #247 — test/bun-migration-batch-4 (testrot Batch 4/5) review
created: 2026-07-16T23:30:28Z
owner: reviewer (independent, dev-team-wt-testrot-b4 worktree)
pr: https://github.com/astragenie/dev-team/pull/247
verdict: PASS
---

# PR #247 review — testrot Batch 4/5

## Scope

Mechanical `node:test`/`node:assert` → `bun:test` conversion of exactly the 23
Batch-4 files listed in the validated scout manifest
(`.claude/artifacts/crew/runs/20260716T230000Z-testrot-scout-manifest.md`).
`git diff --stat` against merge-base `8f0b88e4` shows exactly these 23
`tests/*.test.ts` files touched, zero `scripts/**`, zero `hooks/**`, zero
non-batch files. **Scope: PASS.**

## Semantic preservation

Spot-checked 6 files in full, plus a corpus-wide grep sweep across all 23.

- **`collect-model-compliance.test.ts`** — `assert.equal`/`assert.ok` →
  `expect().toBe()`/`expect().toBeTruthy()`, 1:1. All `result!` non-null
  assertions sit immediately after an `expect(result, ...).toBeTruthy()` that
  node's `assert.ok` used to narrow via its TS `asserts` signature (which
  `expect()` doesn't provide) — narrowing correctly restored, not weakened.
- **`cost-report-emission.test.ts`** — same pattern, plus one
  `if (!result.ok) throw new Error(...)` guard restoring discriminated-union
  narrowing on a `Result<T>` type before accessing `result.value`. Fail-loud,
  correctly placed after the `expect(result.ok, ...).toBeTruthy()` check.
  `assert.notEqual(a, b, msg)` → `expect(a, msg).not.toBe(b)` correctly
  applied (this file has one `notEqual` call not flagged in the manifest's
  per-file edge-case annotation — a manifest documentation gap, not a defect;
  the builder handled it correctly per the recipe table regardless).
- **`validate-agents-peer-dispatch.test.ts`** (820 LOC) — 21 assert sites (15
  `equal` + 6 `ok`), all boolean-valued (`result.ok` vs `true`/`false`),
  converted 1:1 via the documented codemod pattern including correct handling
  of multi-line calls. No manual edits or drift from the mechanical pattern;
  consistent with the scout's pre-validated conversion described in the
  manifest.
- **`validate-contracts.test.ts`** — the one `t.after()` cleanup site
  converted to `try { ... } finally { await unlink(...).catch(() => {}); }`.
  Verified: the `try` block wraps both the `await validateContracts(...)`
  call and both assertions, so cleanup runs via `finally` on any failure path
  (thrown error or failed `expect`), matching node's per-test `t.after`
  cleanup guarantee. **Cleanup-on-failure: confirmed intact.**
- **`dir-cache.test.ts`** — `strictEqual`/`notStrictEqual` → `toBe`/`not.toBe`
  (correct — `toBe` is already `Object.is`, same semantics as `strictEqual`).
- **`memory-provider-noop.test.ts`** — `assert.doesNotReject(promise)` →
  bare `await promise` (the manifest's own recommended "safest" mapping,
  since Bun's `expect().resolves` doesn't have a clean doesNotReject
  equivalent); an uncaught rejection still fails the test. `assert.rejects`
  → `await expect(p, msg).rejects.toThrow()`, correctly awaited (multi-line,
  `await` present on the opening line of the statement).

**Strengthening check (assert.equal loose `==` → toBe `Object.is`):** grepped
every removed `assert.equal`/`assert.notEqual`/`assert.strictEqual` site
across all 23 files. Every comparison is between same-type values already
produced by typed function returns (booleans, numbers, strings, `undefined`,
array lengths) — none compare a number to a string or otherwise rely on
loose-equality coercion. No site where the loose→strict change could flip a
result. `deepEqual`/`doesNotThrow`/`throws`/`doesNotMatch` mappings all match
the manifest's recipe table exactly.

**Remaining `assert.*` in batch files:** zero (grepped all 23 post-conversion
files).

**Import hygiene:** all 23 files now import solely from `bun:test`; no file
retains a `node:test`/`node:assert` import. `validate-dispatch-graph.test.ts`
(the other `describe()`-nesting class-(a) file besides
`validate-agents-peer-dispatch.test.ts`) correctly imports
`{ test, expect, describe }`.

## Full-suite verification

Reran `bun test --timeout 60000 tests/` in the worktree (not trusting the PR
description alone):

```
1094 pass / 116 skip / 94 fail / 93 errors — 210 files, 57.63s
```

Matches the PR's claimed after-totals exactly (before 860/117/116 →
after 1094/94/93, -23/-23, skip unchanged at 116). **Full-suite claim:
CONFIRMED by independent rerun, not just accepted from the PR body.**

## Typecheck / lint / format

- `bunx tsc --project tsconfig.json --noEmit` → clean, exit 0.
- `bunx biome format <all 23 batch-4 files>` → "Checked 23 files. No fixes
  applied." — confirms formatting-only claim; no drift.
- `bunx biome lint` on the 6 spot-checked files → clean.

## Findings

None at any severity. No FAIL-worthy issues found.

## Verdict: PASS

Scope is exactly the 23 manifest files. All assertion mappings are
semantically faithful to the recipe (including the two files needing
non-null-narrowing restoration and the one `t.after`→`try/finally`
rewrite, both verified correct). Full-suite pass/fail delta independently
reproduced. Typecheck and formatting clean. Approved to merge.
