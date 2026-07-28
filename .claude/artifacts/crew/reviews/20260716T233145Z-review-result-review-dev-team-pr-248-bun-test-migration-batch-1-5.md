---
findings: "## dev-team PR #248 (test/bun-migration-batch-1) — decision: approved\n\n### Item 1 — Scope: PASS, exact match (24 files)\n\n`gh pr view 248 --json files` returns exactly 24 files. Diffed (sorted) against the manifest's Batch 1 section (`.claude/artifacts/crew/runs/20260716T230000Z-testrot-scout-manifest.md`): zero diff, byte-for-byte identical file set. Cross-checked with `git diff origin/main...HEAD --name-only`: same 24 paths, all under `tests/`. Zero `scripts/**`, zero `hooks/**`.\n\n### Item 2 — cli-synthesis-cost.test.ts vs. the scout's pre-validated conversion: PASS\n\nRead the full diff. Matches the scout manifest's own earlier validation exactly: `before`/`after` (imported from `node:test`) correctly become `beforeAll`/`afterAll` (not `beforeEach`/`afterEach`, which would have broken the shared `fixtureRoot` tmpdir lifecycle this file relies on across all 7 tests). All `assert.equal`/`assert.notEqual`/`assert.match`/`assert.ok` call sites (including the ones with multi-line message args) map correctly to `expect(...).toBe()/.not.toBe()/.toMatch()/.toBeTruthy()`, with the message argument correctly repositioned as `expect()`'s second parameter throughout.\n\n### Item 3 — Quarantine skip: PASS, exactly as specified\n\n`tests/dispatch-timing.test.ts` diff shows exactly one change beyond the mechanical conversion: `test(...)` → `test.skip(...)` on \"records start + end as single JSONL row with wallMs\", immediately preceded by `// TODO(quarantine): wallMs parallel-contention flake — see scout manifest 20260716T230000Z`. Grepped the entire batch diff for `.skip`/`.only`: this is the only hit anywhere in the 24 files. The `wallMs >= 25` threshold and all other assertion values in the skipped test are untouched — no timing tuning attempted, matching the claim. The assertions inside were still mechanically converted (assert→expect) despite being skipped, so the file isn't left half-migrated.\n\n### Item 4 — Narrowing fixes (4 files): PASS, all `!` sites are unreachable in a failure path\n\nChecked all 4 named files:\n- `collect-hook-health.test.ts` — `ps!`/`h!` (×2 total), each preceded by `expect(ps, \"...\").toBeTruthy();` / `expect(h, \"...\").toBeTruthy();`.\n- `dispatch-timing-pre-tap.test.ts` — `result!` (×2, matching the claimed count), each preceded by `expect(result !== null).toBeTruthy();`.\n- `telemetry-hooks-json.test.ts` — `otelGroup!` (×1), preceded by `expect(otelGroup !== undefined, \"...\").toBeTruthy();`.\n\nSame reasoning as the #245 review: `expect(...).toBeTruthy()` throws (failing the test) before execution ever reaches the non-null-assertion access, so these are purely compiler-narrowing aids with no runtime masking risk — a real falsy value fails the test at the `expect()` line, never silently passes through to the `!` access.\n\n### Item 5 — Semantic preservation, broader check: PASS\n\nSpot-checked 6 files total (`cli-synthesis-cost.test.ts`, `dispatch-timing.test.ts`, `collect-hook-health.test.ts`, `telemetry-hooks-json.test.ts`, `dispatch-timing-pre-tap.test.ts`, plus `crew-write-review-result.test.ts` — the largest/most edge-case-dense file in the batch, 664 LOC with `rejects`×1 + `doesNotMatch`×12). All mappings correct, including `assert.rejects(promise)` (no error-class arg) → `await expect(promise).rejects.toThrow()` and `assert.doesNotMatch(body, re[, msg])` → `expect(body[, msg]).not.toMatch(re)`.\n\n`test(` occurrence counts (treating `test.skip(` as still a test, not a drop) are identical before/after for all 24 files, verified programmatically via `git show origin/main:<file>` vs. working tree. Zero other `.skip`/`.only` beyond the one documented quarantine (see item 3).\n\n### Item 6 — Full-suite claim: PASS, reran myself, exact match\n\n`bun test --timeout 60000 tests/` in the worktree: **1072 pass / 93 fail / 92 errors / 117 skip / 1282 tests / 210 files**, matching the PR's claimed after-numbers exactly. Delta from the 860/117/116/116-skip baseline: -24 fail, -24 errors, +1 skip — exactly matching batch size (24 files) plus the one documented quarantine.\n\n### Item 7 — typecheck / format / lint: PASS, all clean\n\n- `bunx tsc --noEmit -p .` (full project): clean, zero output, exit 0.\n- `bunx biome format tests/<24 files>` (check mode): \"Checked 24 files... No fixes applied.\"\n- `bunx biome lint tests/<24 files>`: \"Checked 24 files... No fixes applied.\"\n\n### No findings. Clean mechanical conversion, consistent with the #245 (batch 2) precedent."
decision: approved
---
# Review Result: Review: dev-team PR #248 — bun:test migration batch 1/5

- Created: 2026-07-16T23:31:45.322Z
- Reviewer: reviewer
- Decision: approved
- Summary: Mechanical review of dev-team PR #248 (test/bun-migration-batch-1), the second of 5 planned node:test to bun:test conversion batches reviewed (batch 2/#245 reviewed previously). Verified all 24 files match the manifest's Batch 1 list exactly, confirmed cli-synthesis-cost.test.ts's conversion matches the scout's own pre-validated conversion pattern (before/after → beforeAll/afterAll with the shared fixtureRoot lifecycle preserved), verified the single quarantine skip in dispatch-timing.test.ts is exactly the one documented test with the required TODO comment and no timing tuning, spot-checked 6 files including all 4 narrowing-fix files and confirmed every non-null assertion is preceded by a throwing expect(), reran the full suite myself and got an exact match to the PR's claimed numbers, and confirmed typecheck/format/lint are clean. PASS.
- Evidence Checked:
  - diffed file list against manifest Batch 1 section (exact match); read full diffs for 6 spot-checked files incl. cli-synthesis-cost.test.ts vs scout's pre-validated conversion and all 4 narrowing-fix files; grepped .skip/.only across the batch (exactly 1
  - the documented quarantine); grepped test( counts per-file before/after (identical
  - treating test.skip as retained); reran bun test tests/ myself; ran tsc --noEmit
  - biome format
  - biome lint on touched files
- Files Reviewed:
  - tests/cli-synthesis-cost.test.ts
  - tests/collect-hook-health.test.ts
  - tests/cost-advisor-grade.test.ts
  - tests/cost-setup.test.ts
  - tests/crew-write-review-result.test.ts
  - tests/dispatch-timing-pre-tap.test.ts
  - tests/dispatch-timing-reader.test.ts
  - tests/dispatch-timing.test.ts
  - tests/enum-verdicts.test.ts
  - tests/gepa-corpus-report.test.ts
  - tests/gepa-corpus-sync.test.ts
  - tests/incomplete-detector.test.ts
  - tests/integration-smoke-skill.test.ts
  - tests/integrator-prompt.test.ts
  - tests/memory-provider-astramem.test.ts
  - tests/resolve-model.test.ts
  - tests/schemas.test.ts
  - tests/telemetry-hooks-json.test.ts
  - tests/test-shard.test.ts
  - tests/tier-classification.test.ts
  - tests/ux-validation-integration.test.ts
  - tests/validate-agents.test.ts
  - tests/validate-badges.test.ts
  - tests/validate-slices.test.ts
- Test Adequacy: Reran full suite myself: 1072 pass / 93 fail / 92 errors / 117 skip / 1282 tests / 210 files, exact match to PR claim. Delta from 860/117/116/116-skip baseline is exactly -24 fail/-24 errors/+1 skip, matching batch size plus the one documented quarantine. typecheck/format/lint clean on all 24 touched files.
- Risks: -
- Required Follow-up: -

