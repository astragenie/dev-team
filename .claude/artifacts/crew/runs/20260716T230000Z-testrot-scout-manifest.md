---
kind: run-brief
title: bun test rot — scout manifest (bun#5090 node:test/bun:test migration)
created: 2026-07-16T23:00:00Z
owner: testrot-scout (read-only investigation)
worktree: C:\work\mega\dev-team-wt-testrot-scout (off origin/main @ 8f0b88e4, includes PR #243)
status: investigation-complete, zero commits, worktree left clean
---

# `bun test` rot — scout manifest

## TL;DR

`bun test --timeout 60000 tests/` on main (`8f0b88e4`) reports **860 pass / 117
fail / 116 errors / 116 skip** across 210 files (1093 tests, 66.98s). Of the
117 failing files:

- **116 files** are pure **bun#5090** fallout — the file imports `test`
  (and/or `describe`, `before`, `after`) from `node:test` instead of
  `bun:test`. This is **not** about literal nesting inside a single file: 3 of
  the sample files I converted **passed cleanly in isolation** even
  unconverted (`bun test <one-file>` succeeds), and 2 unrelated node:test
  files run together also pass. The failure only manifests when the *whole*
  `tests/` directory runs in one `bun test` process — Bun's node:test compat
  shim leaks execution-context state across files when enough of them run
  concurrently in the same process. Converting a file to native `bun:test`
  (`test`/`describe`/`expect`/`beforeAll`/`afterAll`) removes it from that
  shared process-wide state entirely and reliably fixes it — validated below
  by full-suite before/after diffs, not just standalone runs.
- **1 file** (`tests/cli-smoke.test.ts`) is a **real, unrelated failure**:
  Node emits a `[DEP0190] DeprecationWarning` on stderr when spawning a child
  process with `shell:true` + args, breaking an "stderr must be empty"
  assertion. This is an environment/Node-version issue, not a loader bug —
  out of scope for the bun:test migration; needs its own fix or a warning
  filter in the test's `execFile` helper.
- **`tests/gepa/capture-perf.test.ts`** is a false positive from bun's
  per-file console-log grouping (it prints perf stats under its own
  file-section header) — it passed; not actually failing.
- **`tests/dispatch-timing.test.ts`** is in the class-(a) nesting-bug set
  (import-only fix required) but the task brief flags its `wallMs` assertion
  as a known flake — that flakiness is orthogonal and will only resurface
  *after* conversion unblocks the file; whichever batch owns it should watch
  for it separately.

`scripts/test-shard.ts` needs **no changes**. It is a pure file-list
partitioner that always shells out to `bun test <files...>` (`test-shard.ts:107-125`);
it has zero awareness of which test API (`node:test` vs `bun:test`) a file
uses internally, so the bun:test conversion is fully transparent to it.

**Recipe confidence: validated**, not merely inferred. See "Recipe validation
evidence" below — three structurally different files were converted in the
worktree, each confirmed to (a) run standalone with the same test count and
all passing, and (b) reduce the **full-suite** fail/error counts by exactly
that file's contribution when added to the baseline run. All edits reverted;
worktree is clean (`git status --short` empty).

## Classification (117 previously-"failing" files + 1 false positive)

| Class | Count | Description |
|---|---|---|
| (a) bun#5090 nesting/shim leak | 116 | `test()`-in-`test()` (114 files) or `describe()`-in-`test()` (2 files: `tests/validate-agents-peer-dispatch.test.ts`, `tests/validate-dispatch-graph.test.ts`) — all traced to `node:test` imports, all fixed by converting to `bun:test` |
| (b) real assertion failure | 1 | `tests/cli-smoke.test.ts` — Windows/Node-version stderr deprecation warning, unrelated to loader |
| (c) false positive (not actually failing) | 1 | `tests/gepa/capture-perf.test.ts` — console output only, all tests passed |

Sum check: 116 errors reported by bun's summary line = exactly the 116
class-(a) "Unhandled error between tests" blocks. 117 fails reported = 116
class-(a) files (each contributes one outer-test fail) + 1 real `cli-smoke`
fail. This is a clean, fully-accounted reconciliation — no unexplained
residual.

## test-shard.ts cross-check

`scripts/test-shard.ts` (141 lines) does deterministic round-robin file-glob
partitioning (`discoverTestFiles` / `partitionFiles`) then spawns
`bun test --timeout 60000 <shard files...>` per shard (line 114). It imports
nothing from `node:test` or `bun:test` itself and never inspects file
contents beyond the `.test.ts` glob. **No node:test-specific handling
exists that a bun:test conversion would break.** The only latent risk: since
sharding partitions by file, converting files in batches (rather than
all-at-once) changes which shard each converted file lands in shard-to-shard,
but partitioning is content-blind so this has zero correctness impact — CI
shards will just have a shrinking pool of node:test files across the
migration, unaffected functionally either way.

## Recipe validation evidence

Converted and reverted 3 representative files in the worktree (no commits):

### 1. `tests/collect-hook-health.test.ts` (69 LOC — plain flat `test()` list, no shared setup)
- Assert usage: `assert.deepEqual`×1, `assert.equal`×3, `assert.ok`×3.
- Converted imports to `bun:test`'s `test`/`expect`; mapped
  `assert.deepEqual(a,b)` → `expect(a).toEqual(b)`,
  `assert.equal(a,b,msg)` → `expect(a,msg).toBe(b)`,
  `assert.ok(cond,msg)` → `expect(cond,msg).toBeTruthy()`.
- `bun test tests/collect-hook-health.test.ts` → **4 pass / 0 fail** (same
  count as source).
- Confirmed `expect(actual, message)` is a genuine second parameter in Bun
  (not silently ignored) — a synthetic failing assertion with a custom
  message still failed and printed that message verbatim.

### 2. `tests/validate-agents-peer-dispatch.test.ts` (820 LOC — multiple `describe()` blocks, two of them looping over an array to generate `test()` names dynamically)
- Assert usage: `assert.equal`×15, `assert.ok`×6 — all converted via a small
  bracket-depth-aware codemod (handles multi-line calls and template-literal
  messages containing `${...}` interpolation; see recipe script below).
- **Baseline (pre-conversion), run standalone:** `bun test
  tests/validate-agents-peer-dispatch.test.ts` → 21 pass / 0 fail already —
  confirms the failure is process-wide interference, not an in-file nesting
  defect.
- **Post-conversion, standalone:** 21 pass / 0 fail (same 21 tests, all
  still green; +27 `expect()` calls now visible since bun counts assertions).
- **Post-conversion, paired with an untouched node:test file**
  (`tests/cli-synthesis-cost.test.ts`): 28 pass / 0 fail combined — proves
  the converted file no longer contributes to or is vulnerable to the
  cross-file shim leak.
- **Post-conversion, full suite** (`bun test tests/`): 881 pass (+21) / 116
  fail (-1) / 115 errors (-1) vs the 860/117/116 baseline — the *only*
  change was this one file's conversion, and the reduction exactly matches
  its own 21 tests. This is the strongest evidence: fixing one file measurably
  and precisely shrinks the whole-suite failure count.

### 3. `tests/cli-synthesis-cost.test.ts` (385 LOC — flat `test()` list with file-level shared setup: `before`/`after` fixture lifecycle + a `try/finally` env-var restore inside one test)
- Assert usage: `assert.equal`×6, `assert.match`×16, `assert.notEqual`×3,
  `assert.ok`×2 (27 total, all converted by the codemod below).
- `node:test`'s `before`/`after` (file-scoped, run once) map cleanly to
  `bun:test`'s `beforeAll`/`afterAll` — **not** `beforeEach`/`afterEach`,
  which would re-run per-test and break the shared `fixtureRoot` tmpdir
  lifecycle this file relies on.
- Post-conversion, standalone: **7 pass / 0 fail** (same 7 tests).
- Post-conversion, full suite: 867 pass (+7) / 116 fail (-1) / 115 errors
  (-1) vs baseline — again an exact, isolated reduction.

All three files were reverted with `git checkout --`; `git status --short
tests/` is empty.

## Exact recipe

1. **Imports.** Replace:
   ```ts
   import { test } from "node:test";           // or: import test from "node:test";
   import { describe, before, after } from "node:test"; // any subset present
   import assert from "node:assert/strict";
   ```
   with a single:
   ```ts
   import { test, expect /*, describe, beforeAll, afterAll, beforeEach, afterEach */ } from "bun:test";
   ```
   only including the extra named imports the file actually uses.
2. **Hook rename.** `before` → `beforeAll`, `after` → `afterAll` (file/describe-scoped, run once — do **not** use `beforeEach`/`afterEach` unless the source used node:test's own per-test hook, which none of the sampled files did).
3. **Assertion mapping** (covers 2,375 of 2,461 — **96.5%** — of all `assert.*` call sites across the 116 class-(a) files, confirmed by corpus-wide grep):

   | node:assert/strict | bun:test |
   |---|---|
   | `assert.equal(a, b, msg?)` | `expect(a, msg).toBe(b)` |
   | `assert.deepEqual(a, b, msg?)` | `expect(a, msg).toEqual(b)` |
   | `assert.notEqual(a, b, msg?)` | `expect(a, msg).not.toBe(b)` |
   | `assert.match(str, re, msg?)` | `expect(str, msg).toMatch(re)` |
   | `assert.ok(cond, msg?)` | `expect(cond, msg).toBeTruthy()` |

   `expect(actual, message)` is a real Bun feature — verified it still fails
   correctly and surfaces the custom message (see file 1 above), so messages
   are safe to carry over 1:1 rather than dropped.

4. **Edge-case assert methods** (the remaining 3.5%, 86 call sites across 31
   of the 116 files — not yet codemod-covered, need manual mapping per call):

   | node:assert/strict | bun:test | Note |
   |---|---|---|
   | `assert.strictEqual` | `expect(a,msg).toBe(b)` | identical to `.equal` under `/strict` |
   | `assert.notStrictEqual` | `expect(a,msg).not.toBe(b)` | |
   | `assert.doesNotMatch(str, re, msg?)` | `expect(str,msg).not.toMatch(re)` | |
   | `assert.throws(fn, msg?)` | `expect(fn).toThrow()` | when 2nd arg is an Error class/RegExp/validator (not a string), pass it into `.toThrow(...)` instead — check each call, don't blind-script |
   | `assert.doesNotThrow(fn, msg?)` | `expect(fn).not.toThrow()` | |
   | `assert.rejects(asyncFnOrPromise, msg?)` | `await expect(promise).rejects.toThrow()` | needs `await`; confirm call site is already inside an `async` test |
   | `assert.doesNotReject(asyncFnOrPromise, msg?)` | `await expect(promise).resolves.toBeTruthy()` or just `await promise` directly | no exact Bun equivalent; safest is awaiting directly and letting an uncaught rejection fail the test |
   | `assert.fail(msg)` | `throw new Error(msg)` | |

5. **`t.after(cleanup)` (node:test per-test TestContext cleanup) — found in 3
   files** (`tests/orchestrate-slice.test.ts`×3, `tests/validate-contracts.test.ts`×1,
   `tests/validate-ux-spec.test.ts`×1): drop the `(t)` param from the test
   callback and wrap the test body in `try { ... } finally { await cleanup(); }`,
   moving the `t.after(() => cleanup())` call's callback into the `finally`
   block. Bun's plain `test(name, async () => {...})` callback has no
   TestContext argument.
6. No file in the class-(a) set uses `t.test()` subtests, `mock.*`,
   `test.skip`/`describe.skip`/`.only`, or other node:test APIs beyond the
   above — confirmed by corpus-wide grep across all 116 files.

The bracket-depth-aware codemod script used for validation (handles
multi-line calls, template literals with `${...}` interpolation, nested
parens) is disposable/scratch but the pattern is straightforward to
reproduce: locate `assert.<method>(`, walk forward tracking paren/brace/
bracket/template-literal/string nesting depth to find the matching `)`,
split top-level-comma-separated args, re-emit as the mapped `expect(...)`
call.

## Batch manifest (5 batches, ~23 files / ~4,415 LOC each — LOC-balanced greedy bin-pack)

All 116 files live flat in `tests/` (no subdirectory grouping available).
"Edge cases" column flags files needing the manual mappings from step 4/5
above beyond the scripted equal/deepEqual/notEqual/match/ok substitution.
34 of 116 files have at least one edge case; every batch got a mix rather
than concentrating hard files in one batch.

### Batch 1 — 24 files, ~4436 LOC
`cli-synthesis-cost.test.ts` (385), `collect-hook-health.test.ts` (69),
`cost-advisor-grade.test.ts` (205, doesNotThrow×1), `cost-setup.test.ts`
(133, throws×3), `crew-write-review-result.test.ts` (664, rejects×1 +
doesNotMatch×12), `dispatch-timing-pre-tap.test.ts` (238),
`dispatch-timing-reader.test.ts` (290), `dispatch-timing.test.ts` (45 —
**known wallMs flake, watch after unblocking**), `enum-verdicts.test.ts`
(514, rejects×3), `gepa-corpus-report.test.ts` (120), `gepa-corpus-sync.test.ts`
(218, doesNotMatch×1), `incomplete-detector.test.ts` (68),
`integration-smoke-skill.test.ts` (29), `integrator-prompt.test.ts` (38),
`memory-provider-astramem.test.ts` (328, doesNotReject×2),
`resolve-model.test.ts` (107), `schemas.test.ts` (45),
`telemetry-hooks-json.test.ts` (101), `test-shard.test.ts` (90, throws×4 —
tests the sharder itself, low risk), `tier-classification.test.ts` (147),
`ux-validation-integration.test.ts` (82), `validate-agents.test.ts` (257),
`validate-badges.test.ts` (99), `validate-slices.test.ts` (164)

### Batch 2 — 23 files, ~4412 LOC
`cost-advisor-trends.test.ts` (248), `cost-report-agent-stats-section.test.ts`
(145), `cost-watch.test.ts` (312), `crew-profile-cli.test.ts` (30),
`dispatch-handle-store.test.ts` (91, rejects×2), `hook-error-events.test.ts`
(40, doesNotReject×1), `memory-profile-feedback.test.ts` (103),
`memory-provider-file.test.ts` (279), `model-routing-enforce.test.ts` (191),
`orchestrate-slice.test.ts` (233, doesNotReject×1 + **t.after() cleanup×3**),
`outcome-linkage-rebound.test.ts` (73), `prune-artifacts.test.ts` (163,
rejects×1), `regression.test.ts` (497, doesNotMatch×2 + strictEqual×1),
`routing-schema.test.ts` (64, throws×4), `scope-estimate.test.ts` (81),
`session-cost-scanner-compute.test.ts` (363), `subagent-profile-hook.test.ts`
(111), `subagent-return.test.ts` (772), `telemetry-plugin-cache-smoke.test.ts`
(214), `telemetry-span-schema.test.ts` (97, throws×1), `validate-agent-refs.test.ts`
(109), `validate-org-refs.test.ts` (64), `worktree-manager.test.ts` (132,
doesNotReject×2)

### Batch 3 — 23 files, ~4413 LOC
`cost-hygiene-decide.test.ts` (239), `dispatch-size-gate.test.ts` (402),
`fleet.test.ts` (177), `frontend-dev-prompt.test.ts` (42),
`heavy-path-review-refinements.test.ts` (127), `hook-cold-start-bench.test.ts`
(65), `hook-feature-gating.test.ts` (985 — **largest file in the set**,
fail×2 + rejects×1), `ids.test.ts` (30), `log-event-async-bench.test.ts`
(63), `memory-inject-profile.test.ts` (259, doesNotMatch×1),
`memory-provider-schema.test.ts` (75, doesNotThrow×3 + throws×6 — **highest
edge-case density**), `memory-write-handoff-credit.test.ts` (145),
`parallel-gates.test.ts` (71, throws×2), `preflight-shell.test.ts` (361,
doesNotMatch×3), `render-routing-table.test.ts` (83, doesNotMatch×1),
`telemetry-cli.test.ts` (207), `telemetry-cost-report-loader.test.ts` (96,
rejects×2), `telemetry-cost-report-to-spans.test.ts` (153),
`telemetry-otel-bridge.test.ts` (225), `telemetry-scrub.test.ts` (106),
`tier-in-run-brief.test.ts` (99), `validate-routing-table.test.ts` (292),
`workflow-state-concurrent.test.ts` (111)

### Batch 4 — 23 files, ~4417 LOC
`collect-model-compliance.test.ts` (83), `cost-hygiene-state.test.ts` (245),
`cost-report-emission.test.ts` (489), `dir-cache.test.ts` (68, strictEqual×1
+ notStrictEqual×1), `drift-check-cli.test.ts` (179, throws×1),
`features-service.test.ts` (362), `gepa-corpus-optimize.test.ts` (127,
doesNotMatch×1), `incident-dispatcher.test.ts` (231), `journey-builder.test.ts`
(112), `jsonl.test.ts` (74), `memory-drift-check.test.ts` (155),
`memory-provider-config.test.ts` (105, throws×2 + doesNotThrow×1),
`memory-provider-decay.test.ts` (145), `memory-provider-noop.test.ts` (82,
doesNotReject×3 + rejects×1), `memory-recall-injection-completeness.test.ts`
(59), `run-crew.test.ts` (44), `telemetry-hook-flush.test.ts` (210),
`validate-agents-peer-dispatch.test.ts` (820 — **already validated in this
scout run, see above**), `validate-backlog-drift.test.ts` (36),
`validate-contracts.test.ts` (97, **t.after() cleanup×1**),
`validate-dispatch-graph.test.ts` (308 — describe()-nesting variant, already
confirmed class-(a)), `validate-skills-frontmatter.test.ts` (108),
`validate-syntheses.test.ts` (278)

### Batch 5 — 23 files, ~4417 LOC
`cli-workflow.test.ts` (681, rejects×1), `cost-hygiene-hook.test.ts` (233),
`cost-report-role-breakdown.test.ts` (369), `docs-only.test.ts` (106),
`fs-utils.test.ts` (98, rejects×3), `gepa-provenance-validate.test.ts` (73),
`installer.test.ts` (513, doesNotMatch×3 + rejects×1),
`memory-handoff-credit.test.ts` (164), `memory-handoff-digest.test.ts` (224,
doesNotMatch×2), `memory-inject-recall.test.ts` (336),
`memory-injected-atoms.test.ts` (66), `projects-root-override.test.ts` (152),
`result.test.ts` (43), `telemetry-config.test.ts` (102),
`ux-validation.test.ts` (287), `validate-adr-template.test.ts` (140),
`validate-agents-frontmatter.test.ts` (253), `validate-all.test.ts` (36),
`validate-configs.test.ts` (194), `validate-loop-state.test.ts` (78),
`validate-skills.test.ts` (91), `validate-ux-spec.test.ts` (60, **t.after()
cleanup×1**), `validation-gate-delegation.test.ts` (118, doesNotMatch×2)

(`tests/cli-synthesis-cost.test.ts` in Batch 1 was already validated in this
scout run — see above; its conversion can be lifted verbatim by whoever
takes Batch 1, then reverted-and-reapplied or just left in place if they
start there.)

## Quarantine seed list

Only 1 file — the rest of the "failing" population is entirely accounted for
by class (a):

- **`tests/cli-smoke.test.ts`** — `smoke: claims family (init)` fails
  because `execFile("node", ["--experimental-strip-types", ...])` (via
  `tests/helpers/cli-fixtures.ts`) triggers Node's `[DEP0190]
  DeprecationWarning` about unescaped shell args on this machine's Node
  version, landing on stderr and breaking `assert.match(stderr, /^(\s*)$/)`.
  Not a bun:test/node:test issue — separate fix needed (either strip
  deprecation warnings from the stderr assertion, or stop invoking node
  with `shell:true`+array-args). Out of scope for this migration; flag as
  its own ticket.

## Files

- Manifest: `C:\work\mega\dev-team\.claude\artifacts\crew\runs\20260716T230000Z-testrot-scout-manifest.md` (this file, untracked — not committed per task instructions)
- Worktree used (left in place, clean, zero commits): `C:\work\mega\dev-team-wt-testrot-scout` @ `8f0b88e4b961e4c33a7d750affafc8b232d38630`
