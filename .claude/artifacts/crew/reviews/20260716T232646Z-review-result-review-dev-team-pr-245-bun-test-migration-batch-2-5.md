---
findings: "## dev-team PR #245 (test/bun-migration-batch-2) — decision: approved\n\n### Item 1 — Scope: PASS, exact match\n\n`gh pr view 245 --json files` returns exactly 23 files. Diffed (sorted) against the manifest's Batch 2 list (`.claude/artifacts/crew/runs/20260716T230000Z-testrot-scout-manifest.md`, \"Batch 2 — 23 files\" section): zero diff, byte-for-byte identical file set. Cross-checked with `git diff origin/main...HEAD --stat` (23 files changed, 698 insertions, 690 deletions) — same 23 paths, all under `tests/`. Zero `scripts/**`, zero `hooks/**`, zero non-batch files.\n\n### Item 2 — Semantic preservation: PASS, spot-checked 6 files + programmatic check across all 23\n\nRead full diffs for `dispatch-handle-store.test.ts`, `orchestrate-slice.test.ts`, `worktree-manager.test.ts` (the three hand-fixed files named), plus `cost-report-agent-stats-section.test.ts`, `regression.test.ts`, `routing-schema.test.ts` (edge-case-heavy: `doesNotReject`, `t.after()`×3, `doesNotMatch`, `strictEqual`, `throws`×4). Every mapping matches the manifest's recipe table exactly: `assert.ok→toBeTruthy`, `assert.equal→toBe`, `assert.deepEqual→toEqual`, `assert.notEqual→not.toBe`, `assert.match→toMatch`, `assert.doesNotMatch→not.toMatch`, `assert.strictEqual→toBe`, `assert.rejects(p)→await expect(p).rejects.toThrow()`, `assert.throws(fn)→expect(fn).toThrow()`, `assert.doesNotReject(p)→await p` directly (matches the manifest's own documented \"no exact Bun equivalent\" guidance). All 3 `t.after()` cleanup sites in `orchestrate-slice.test.ts` correctly became `try { ... } finally { await cleanup(); }` with the `(t)` param dropped from the test callback — cleanup ordering and exception semantics preserved.\n\n**On the assert.equal loose-vs-strict concern specifically:** confirmed all 23 files import `assert from \"node:assert/strict\"` (not plain `node:assert`), verified by grepping every file's pre-conversion import line. Under `/strict`, `assert.equal` is already aliased to `assert.strictEqual` (Object.is-style, not `==`), and `assert.deepEqual` is already aliased to `assert.deepStrictEqual`. So mapping `assert.equal→toBe` and `assert.deepEqual→toEqual` does not strengthen or weaken anything — the source assertions were already strict before this PR touched them. The loose-`==` risk the checklist flagged doesn't apply to this codebase's usage.\n\n**Test-name and test-count preservation:** grepped `test(` occurrence counts per file, before (`git show origin/main:<file>`) vs after (working tree) — identical count for all 23 files (verified programmatically, not just the 6 spot-checked). Zero `.skip`/`.only` introduced anywhere in the diff (grepped the full batch diff, zero hits) — matches the PR's \"zero quarantine\" claim.\n\n### Item 3 — Narrowing-guard inserts: PASS, no failure-masking risk\n\nSearched the full batch diff for newly-added `if (!x) return;`/`if (!x) continue;` guards. Found them in exactly 2 files:\n- `tests/worktree-manager.test.ts` (6 occurrences) — **all pre-existing**, confirmed by diff context (no `+`/`-` markers on those lines, only the preceding `assert.equal→expect().toBe()` line changed). This file already used the guard-after-assert pattern before the migration; the builder correctly left it untouched. This is the file the PR body cites as the pattern's precedent.\n- `tests/cost-report-agent-stats-section.test.ts` (3 occurrences) — **genuinely new**, added by this conversion. Checked each: all three are `expect(r.ok[, msg]).toBeTruthy(); if (!r.ok) return;` — the `expect().toBeTruthy()` call throws (failing the test) before the guard is ever reached when `r.ok` is falsy, so the `return` is unreachable in any real failure. No fail→silent-pass conversion is possible with this pattern.\n\n### Item 4 — Full-suite claim: PASS, reran myself, exact match\n\n`bun test --timeout 60000 tests/` in the worktree: **1141 pass / 94 fail / 93 errors / 1351 tests / 210 files**, matching the PR's claimed \"after\" numbers exactly. The \"before\" baseline (860/117/116) matches what I independently measured on this same main commit (`8f0b88e4`) during an earlier review session in this repo. Delta: -23 fail, -23 errors, +281 pass, +258 net tests (1351-1093, accounting for the `expect()` call-count difference vs raw test-count) — the fail/error reduction is exactly -23/-23, matching the batch's file count precisely.\n\n### Item 5 — typecheck / format / lint: PASS, all clean\n\n- `bunx tsc --noEmit -p .` (full project): clean, zero output, exit 0.\n- `bunx biome format tests/<23 files>` (check mode, no `--write`): \"Checked 23 files... No fixes applied.\"\n- `bunx biome lint tests/<23 files>`: \"Checked 23 files... No fixes applied.\"\n\n### No findings. Clean mechanical conversion."
decision: approved
---
# Review Result: Review: dev-team PR #245 — bun:test migration batch 2/5

- Created: 2026-07-16T23:26:46.480Z
- Reviewer: reviewer
- Decision: approved
- Summary: Mechanical review of dev-team PR #245 (test/bun-migration-batch-2), the first of 5 planned node:test to bun:test conversion batches per the testrot scout manifest. Verified all 23 files match the manifest's Batch 2 list exactly with zero out-of-scope files touched, spot-checked 6 files (including all 3 flagged hand-fixed files) for assertion-semantics preservation and confirmed test counts are identical per-file across all 23 files, verified the two narrowing-guard inserts are unreachable in any failure path, reran the full suite myself and got an exact match to the PR's claimed before/after numbers (860/117/116 to 1141/94/93, a clean -23/-23), and confirmed typecheck/format/lint are all clean on the touched files. PASS.
- Evidence Checked:
  - diffed file list against manifest Batch 2 section (exact match); read full diffs for 6 spot-checked files incl. all 3 hand-fixed ones; grepped test( counts per-file before/after (identical); grepped .skip/.only (zero hits); grepped node:assert/strict import on all 23 files (confirmed strict
  - not loose); grepped narrowing-guard inserts and traced each to its preceding failing expect(); reran bun test tests/ myself; ran tsc --noEmit
  - biome format
  - biome lint on touched files
- Files Reviewed:
  - tests/cost-advisor-trends.test.ts
  - tests/cost-report-agent-stats-section.test.ts
  - tests/cost-watch.test.ts
  - tests/crew-profile-cli.test.ts
  - tests/dispatch-handle-store.test.ts
  - tests/hook-error-events.test.ts
  - tests/memory-profile-feedback.test.ts
  - tests/memory-provider-file.test.ts
  - tests/model-routing-enforce.test.ts
  - tests/orchestrate-slice.test.ts
  - tests/outcome-linkage-rebound.test.ts
  - tests/prune-artifacts.test.ts
  - tests/regression.test.ts
  - tests/routing-schema.test.ts
  - tests/scope-estimate.test.ts
  - tests/session-cost-scanner-compute.test.ts
  - tests/subagent-profile-hook.test.ts
  - tests/subagent-return.test.ts
  - tests/telemetry-plugin-cache-smoke.test.ts
  - tests/telemetry-span-schema.test.ts
  - tests/validate-agent-refs.test.ts
  - tests/validate-org-refs.test.ts
  - tests/worktree-manager.test.ts
- Test Adequacy: Reran full suite myself: 1141 pass / 94 fail / 93 errors / 1351 tests / 210 files, exact match to PR claim. Before baseline (860/117/116) matches my own independent measurement of the same main commit from an earlier session. Delta -23 fail/-23 errors matches batch size exactly. typecheck/format/lint clean on all 23 touched files.
- Risks: -
- Required Follow-up: -

