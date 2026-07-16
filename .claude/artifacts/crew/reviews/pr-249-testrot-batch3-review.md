---
findings: "🔴:0,🟡:1,❓:0"
status: completed
decision: approved_with_notes
---
# Review Result: PR #249 — bun test rot, Batch 3/5 (node:test → bun:test)

- Created: 2026-07-17T00:00:00Z
- Reviewer: independent review (crew:reviewer equivalent)
- Decision: approved_with_notes
- Status: completed
- Summary: Mechanical, well-scoped conversion of exactly the 23 Batch-3 manifest files. All three non-recipe fixup categories verified correct: the 3-arg `test(name, {timeout,skip}, fn)` → bun shape conversion is right in all three affected files, including the restored Windows/CI skip in `log-event-async-bench.test.ts` (confirmed live: skip count is 116→117, exactly +1). The `assert.rejects` validator-fn → `rejects.toBeInstanceOf(...)` conversion in `telemetry-cost-report-loader.test.ts` drops nothing — both original validators checked only `instanceof`, no message/code checks were present to lose. Every `!` non-null assertion across the four flagged files sits strictly after a `expect(x, ...).toBeTruthy()`/`toBe(...)` guard on that exact variable — throw-first-then-narrow, no bypassed null check anywhere. Re-ran the full suite live and independently reproduced the exact claimed numbers (1072/117/94/93). `tsc --noEmit` clean; `biome format` clean; `biome lint` surfaced 2 warnings (unused `catch (err)`) that I traced to the pre-conversion source — confirmed pre-existing, not introduced by this PR. Same operational `auto-merge` fail-closed flag as PR #246, not a code defect.

## Verified against diff

**Note on method**: `gh pr diff 249` returned `HTTP 503` (same transient GitHub API issue as every other PR reviewed this session). Reconstructed from the worktree: `git diff` between `HEAD` (`4f98ac41`) and `8f0b88e4` (the scout manifest's stated baseline, confirmed as the correct merge-base) reproduced exactly the 23 files / +673/-743 the PR declares via `gh pr view --json files,additions,deletions`.

1. **Scope** — PASS. `git diff --stat` shows exactly the 23 files from the manifest's Batch 3 list, all under `tests/`. Zero `scripts/**`, zero `hooks/**`, zero non-batch files.

2. **Fixup (a): 3-arg `test(name, {timeout,skip}, fn)` → bun shape** — PASS, all three files:
   - `hook-cold-start-bench.test.ts`: `{ timeout: 30000 }` correctly moved from node:test's middle-argument position to bun's trailing `test(name, fn, options)` position. No skip involved here.
   - `preflight-shell.test.ts`: `{ skip: process.platform !== "win32" }` → `test.skipIf(process.platform !== "win32")(name, fn)` — a direct boolean-condition carryover, correct.
   - `log-event-async-bench.test.ts`: the original `skip` field was a ternary yielding a truthy reason string when `IS_WINDOWS` (or, failing that, `IS_CI`) and `false` otherwise — algebraically equivalent to `IS_WINDOWS || IS_CI`. Converted to `test.skipIf(IS_WINDOWS || IS_CI)(...)`, which is the exact same boolean condition. **Independently confirmed the "silently never skipped, now restored" claim**: reran the full suite live and got `117 skip` (not the baseline's 116) — the manifest's baseline was 116, this PR's claimed after-total is 117, and I reproduced 117 exactly. This is strong evidence the skip is now actually firing (previously, per the PR's explanation, Bun silently discarded the unusable middle-position options object under the old 3-arg node:test shape and ran the test unconditionally).

3. **Fixup (b): `assert.rejects` validator-fn → `rejects.toBeInstanceOf`** — PASS. Read both call sites in `telemetry-cost-report-loader.test.ts`: `(err: unknown) => { assert.ok(err instanceof AggregateReportSkipped, "..."); return true; }` and the analogous `Error` check. **Both validators check only `instanceof` — no message or `.code` assertions inside either validator function** — so `await expect(loadCostReport(...)).rejects.toBeInstanceOf(AggregateReportSkipped)` (and the `Error` variant) is a complete, lossless 1:1 mapping. Nothing was dropped.

4. **Fixup (c): `!` non-null assertion placement** — PASS across all four flagged files. Every occurrence checked (`dispatch-size-gate.test.ts`: `result!.subagentType/.prompt/.cwd`; `fleet.test.ts`: `self!.repoName`; `telemetry-cost-report-to-spans.test.ts`: `root!`/`phase!`/`agent!` × 9 accesses; `telemetry-otel-bridge.test.ts`: `payload!`, `toolCallSpan!` × 3, `stopSpan!` × 2) sits immediately after an `expect(x, "...").toBeTruthy()` (or `x !== null/undefined` truthiness check) on that exact same variable, which fails the test first if the value is actually missing — the `!` only restores compile-time narrowing, it never bypasses a runtime check. One pre-existing `sibling!.repoName` in `fleet.test.ts` predates this PR (present in the original node:test source without an explicit guard) — unrelated to this PR's fixups, not a regression it introduced.

5. **Full-suite claim** — PASS, **independently re-run**, not just read. `bun test --timeout 60000 tests/` in the worktree produced: **1072 pass / 117 skip / 94 fail / 93 errors / 2159 expect() calls, 1283 tests across 210 files in 67.18s** — matches the PR's claimed after-numbers exactly (pass +212 from baseline 860, fail −23, errors −23, skip +1 from the restored Windows/CI skip). Grepped the run output for all 23 batch-3 filenames: zero matches in the remaining fail/error blocks.

6. **Typecheck + biome** — mostly PASS, one pre-existing nit surfaced. `bunx tsc --noEmit` — zero output, exit 0. `bunx biome format` on all 23 touched files — "Checked 23 files... No fixes applied," clean. `bunx biome lint` on all 23 touched files surfaced **2 warnings** (both `lint/correctness/noUnusedVariables` on `catch (err)` in `hook-feature-gating.test.ts`, lines 114 and 440) — exit code 0 (warnings, not errors). Traced both to the **pre-conversion source**: extracted the original file at the manifest's baseline commit and linted it directly — both warnings are present there too, on the exact same `catch (err)` lines, which this PR's diff never touches (only the preceding `assert.fail(...)` → `throw new Error(...)` line above each was changed). Confirmed pre-existing technical debt, not introduced by this PR.

## Open item (operational, not a code-quality finding)

Same pattern as PR #246: `gh pr checks 249` shows `auto-merge` as `fail` while the `test` CI jobs are still `pending`/in-progress (one shard already passed). `.github/workflows/auto-merge.yml`'s documented behavior is fail-closed on GitHub API errors, and this PR touches no sensitivity-gated paths. Given the GitHub API 503 instability encountered repeatedly and independently across every PR reviewed this session (including this run's own `gh pr diff`), this reads as the same outage tripping the fail-closed gate rather than a real sensitivity match. Worth a retry once the API stabilizes.

- Files Reviewed:
  - All 23 batch-3 `tests/*.test.ts` files (diff `--stat` reviewed for scope)
  - Full diffs read for: `hook-cold-start-bench.test.ts`, `log-event-async-bench.test.ts`, `preflight-shell.test.ts` (fixup a), `telemetry-cost-report-loader.test.ts` (fixup b), `dispatch-size-gate.test.ts`, `fleet.test.ts`, `telemetry-cost-report-to-spans.test.ts`, `telemetry-otel-bridge.test.ts` (fixup c), `hook-feature-gating.test.ts` (lint warning trace)
  - Pre-conversion baseline source (`git show 8f0b88e4:tests/hook-feature-gating.test.ts`) linted directly to confirm the 2 biome warnings pre-date this PR
  - `.github/workflows/auto-merge.yml` (to interpret the `auto-merge` check failure, same as PR #246)
  - Live command output: `bun test --timeout 60000 tests/`, `bunx tsc --noEmit`, `bunx biome format`/`lint` against the 23 touched files
- Test Adequacy: N/A — this PR is itself a test-file migration; validated by independently re-running the full suite and confirming the exact predicted before/after delta, rather than trusting the PR description's numbers.
- Test Adequacy Skip Reason: N/A
- Risks: None blocking. `auto-merge` check needs a retry once GitHub API stabilizes (operational, see above). 2 pre-existing biome warnings in `hook-feature-gating.test.ts` are unrelated debt this PR didn't introduce and isn't obligated to fix.
- Required Follow-up: Retry or manually resolve the `auto-merge` workflow run. No code changes requested.
