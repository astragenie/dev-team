# Task Handoff: FEAT-193 S1 — Failure → GEPA trial-store bridge

- Created: 2026-07-06T14:33:08Z
- From: fullstack-dev (builder)
- To: reviewer (autonomous_safe=false — human/reviewer gate required, do not self-approve)
- Objective: dual-write a failing GEPA Trial alongside every FEAT-188 S1a
  failure-capture point (review rejected/needs_fix, validation fail,
  inline-return-warn, subagent-incomplete), reusing the existing
  gepa-core fileStore.put() writer (capture-tee.ts), never hand-rolling a
  second JSONL writer.

## Status
IN-PROGRESS handoff → ready for re-review. **Update (post first review):**
this dual-write was merged to `main` once, then **reverted** — CI caught a
real regression (`tests/crew-write-review-result.test.ts`'s dual-write test
timed out at 5s / CLI exited 1 on a cold machine). Root cause + fix are in
commit `a15ee94c` (see Risk #3, rewritten below) and are the reason this
handoff is being resubmitted. One architecture deviation (Risk #1) still
needs reviewer sign-off.

## Allowed scope (per dispatch)
- New module under `scripts/lib/gepa/`
- Wiring into the 4 existing S1a capture points
  (`scripts/lib/artifacts/write.ts`, `hooks/lib/check-subagent-return.ts`)
- Slice-scoped tests only

## Forbidden scope (honored)
- FEAT-193 S2 (corpus-sync) / S3 (report) — not built
- astramem — not touched
- FEAT-188 code — not modified beyond merging main to pick up S1a as a
  prerequisite (see Notes)

## Deliverable
`captureFailureTrial()` — a fire-and-forget writer that appends a failing
Trial (`score.pass:false, score.score:0`) to
`.claude/artifacts/crew/gepa/trials/<agent>.jsonl`, wired dual-write style
beside `captureFailureLearning()` at all 4 S1a capture points.

## Changed files
- `scripts/lib/gepa/capture-failure-trial.ts` (new) — the writer.
- `scripts/lib/gepa/capture-tee.ts` — exported `computePromptHash` (was
  private) for reuse.
- `scripts/lib/artifacts/write.ts` — `fireFailureCaptureSilent` now also
  calls `captureFailureTrial` (dynamic import + try/catch, mirrors the
  existing `fireCaptureTeeSilent` pattern).
- `hooks/lib/check-subagent-return.ts` — inline-return-warn and
  subagent-incomplete both call a new `fireFailureTrialSilent` helper
  (dynamic import, NOT a static top-level import — see Risks).
- `tests/gepa/capture-failure-trial.test.ts` (new) — 7 unit tests.
- `tests/crew-write-review-result.test.ts` — +1 integration test (rejected
  review dual-writes a trial via the real CLI subprocess).
- `tests/subagent-return.test.ts` — +2 integration tests (inline-return-warn
  / subagent-incomplete dual-write via the real hook) + 2 small test helpers
  (`seedGepaConfig`, `readTrialLines`).
- `scripts/lib/gepa/capture-failure-trial-guard.ts` (new, fix-forward commit
  `a15ee94c`) — timeout-guarded wrapper; see Risk #3.
- `tests/gepa/capture-failure-trial.test.ts` (fix-forward) — +2 tests for
  the guard (happy path + forced 0ms-timeout drop).
- `tests/crew-write-review-result.test.ts` (fix-forward) — the dual-write
  test rewritten for best-effort semantics + a module-scope gepa-core
  pre-warm.

## Confidence
High on correctness of the dual-write wiring and test coverage. Medium on
the `source` field decision below — it's a deliberate, documented deviation
from the FEAT-193 S1 spec text, not an oversight, but it changes what a
downstream S2/S3 consumer would filter on.

## Risks / open questions (read before merging)

1. **`source: "production"` is not schema-valid — used `"captured"` +
   `input.capture_origin` marker instead.** The FEAT-193 spec calls for
   `source: "production"` to distinguish these trials from capture-tee.ts's
   `source: "captured"`. I verified against the *published* npm tarball
   (`@astragenie/gepa-core@0.7.0`, the version pinned in `package.json`)
   and the source-of-truth sibling repo
   (`C:\work\mega\gepa-core\packages\gepa-core\src\types\trial.ts`, HEAD
   `c2bf277`) that `TrialSchema.source` is `z.enum(["eval", "captured",
   "soak"])` — no `"production"` value exists anywhere upstream. Writing
   the literal string would make `fileStore.put()`'s internal
   `TrialSchema.parse()` throw (silently dropped by design — never a
   crash, but the trial would never land), and even a row that somehow
   slipped past validation would be silently discarded by
   `readJsonlSafe()` on every future `recall()` call. I chose to keep the
   trials **functional and recallable**: `source: "captured"` (schema-valid)
   + `input.capture_origin: "production_failure"` (Trial.input is
   `z.unknown()`, free-form) as the distinguishing marker. Documented at
   length in `capture-failure-trial.ts`'s header comment.
   **Follow-up FEAT recommended**: extend gepa-core's `Trial.source` enum
   with `"production"` upstream (cross-repo, `astragenie/plugins-common`,
   needs its own session per the repo's cross-repo-write constraint) and
   switch this module to the literal enum value once that ships. Until
   then, any FEAT-193 S2/S3 consumer must filter production-failure trials
   via `input.capture_origin === "production_failure"`, not `source`.

2. **Worktree was stale relative to `main` at dispatch time** — this
   worktree branch forked *before* `a5a1517` (FEAT-188 S1a) and `ea58b2c`
   landed on `main`, so none of the capture points the dispatch told me to
   read/build on top of existed here initially. I merged `main` into the
   worktree branch (commit `7afcd46`, clean merge, no conflicts) before
   wiring — otherwise this slice would have been unbuildable. Flagging in
   case other in-flight worktrees from the same session are similarly
   stale.

3. **Two rounds of the same root cause — both fixed, second one caught by
   CI after a merge+revert.**

   **Round 1** (pre-first-handoff): my first wiring attempt used a static
   top-level `import { captureFailureTrial } from
   "../../scripts/lib/gepa/capture-failure-trial.ts"` in
   `check-subagent-return.ts`. That file is invoked via plain `node
   --experimental-strip-types` (not bun) by the real hook shim
   (`hooks/check-subagent-return.ts`) — and the installed
   `@astragenie/gepa-core` package's `main`/`exports` point at raw `.ts`
   source (not a compiled `dist/`), which Node explicitly refuses to
   type-strip under `node_modules`
   (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`). A static import crashed
   the *entire hook module load*, not just the capture call — caught by 2
   failing spawn-based smoke tests in `tests/subagent-return.test.ts`. Fixed
   by switching to a dynamic `import()` wrapped in try/catch
   (`fireFailureTrialSilent`), matching `write.ts`'s `fireCaptureTeeSilent`
   pattern for the identical hazard.

   **Round 2** (post-merge, caught by CI, this branch reverted from `main`
   and resubmitted): a dynamic `import()` avoids the hard crash, but it does
   NOT avoid the *cost* of a cold module load — resolving/parsing/linking
   the whole `@astragenie/gepa-core` provider tree (ollama, generic-openai,
   groq, gemini, azure-openai — all eagerly re-exported from its `index.ts`)
   the first time any process touches it. On the CI/build machine that load
   took long enough to blow past `write-review-result`'s expected CLI
   latency and the test's default timeout (5s) — the CLI exited non-zero.
   It only "passed" in my worktree because gepa-core was already warm from
   dozens of earlier `bun test` runs in the same session.

   **Fix** (commit `a15ee94c`): `scripts/lib/gepa/capture-failure-trial-guard.ts`
   is a new module with **no runtime dependency on gepa-core at all** (only
   a `import type` of `FailureTrialInput`, erased at compile time) — so
   importing it is always cheap. Its `captureFailureTrialGuarded()` races
   the real `import("./capture-failure-trial.ts")` + `captureFailureTrial()`
   call against a **~1.5s `Promise.race` ceiling**; on timeout OR error it
   silently drops the trial. Both call sites (`write.ts`'s
   `fireFailureCaptureSilent`, the hook's `fireFailureTrialSilent`) now go
   through the guard, not `capture-failure-trial.ts` directly. Matches the
   operator decision: astramem is the source of truth, this JSONL corpus is
   a derived duplicate — a trial dropped under a slow/cold load is an
   acceptable trade for a CLI/hook that never hangs.

   Caveat: `Promise.race` cannot cancel the underlying dynamic import — a
   slow cold load keeps running in the background after the guard times
   out and returns. This is intentional and safe (fire-and-forget, no
   shared mutable state at risk) but means the *logical* ceiling is ~1.5s
   even though the *process* may still have that background work in flight
   briefly after the CLI/hook has already moved on.

   Test changes to match: `tests/crew-write-review-result.test.ts`'s
   dual-write test now asserts what the regression actually was — the CLI
   must always exit 0 — and treats the trial file's existence as
   best-effort (checked/validated only if present, never required). It also
   pre-warms `@astragenie/gepa-core` at module scope in the parent (Bun)
   test process before spawning any CLI child, to bias the common case
   toward the happy path by warming the OS-level file cache (shared across
   processes) even though each spawned child's own V8/Node module cache
   always starts empty. Verified: `tests/crew-write-review-result.test.ts`
   run alone (not as part of a warm multi-file suite) → 11/11 pass, ~13s
   wall time for the whole file.

   **Recommended upstream fix (cross-repo, not done here)**: file a
   `plugins-common` issue/FEAT to have `@astragenie/gepa-core` publish and
   resolve to its compiled `dist/*.js` as `main`/`exports` instead of raw
   `src/*.ts`. That removes the cold-parse cost for every consumer of the
   package, not just this guard — the guard is a local mitigation, not a
   fix of the underlying package defect.

4. **Pre-existing, NOT newly introduced: `write.ts`'s existing
   `fireCaptureTeeSilent` (capture-tee.ts, shipped before FEAT-193) has the
   identical cold-gepa-core-load exposure and is still unguarded.** It runs
   *before* my `fireFailureCaptureSilent` in `writeArtifact`, so in the
   common case it pays the cold-load cost first and warms the process's
   module cache for my code — but on a sufficiently slow/cold machine, THAT
   call alone could still stall a `writeArtifact` invocation for multiple
   seconds, independent of anything in this slice. Out of scope for FEAT-193
   S1 to fix (not part of the dispatched capture points), but flagging
   because it's the same hazard class one layer up — recommend a follow-up
   to wrap `fireCaptureTeeSilent`'s dynamic import in the same
   `captureFailureTrialGuarded`-style race, or fast-track the upstream
   compiled-`dist/` fix so neither call site needs a guard at all.

5. **`hooks/lib/check-subagent-return.ts` has no reliable agent identity**
   — PostToolUse on the `Task` tool carries no `subagent_type` field, so
   the inline-return-warn / subagent-incomplete trials are written under
   `agent: "unknown"`, `phase: "build"` (consistent with
   `adapt-artifact.ts`'s `KIND_TO_PHASE` default for non-phase-specific
   artifact kinds). This means those two signals produce a shared
   `unknown.jsonl` file rather than per-agent files — acceptable for S1
   (bridging the signal), a known limitation for S2/S3 to potentially
   improve (e.g. threading agent identity through the dispatch-handle
   store that already crosses this same process boundary for
   `dispatch-timing`).

## Evidence
- `bun test tests/crew-write-review-result.test.ts` run **ALONE** (the file
  that failed at 5s on `main`) → **11 pass, 0 fail**, ~13s wall time.
- `bun test tests/gepa/capture-failure-trial.test.ts tests/subagent-return.test.ts tests/capture-learning.test.ts tests/gepa/capture-tee.test.ts` → **72 pass, 0 fail** (44 expect() calls).
- Combined slice-scoped total: **83 pass, 0 fail** across the 5 files (7 net
  new vs. the first handoff: +2 guard tests, existing counts otherwise
  unchanged since the fix is call-site rewiring, not new capture points).
- `bun run typecheck` → clean (no unused-import diagnostic on
  `captureFailureTrialGuarded` — both call sites use it).
- `bun run lint` (scripts/ + hooks/) → clean, 0 warnings.
- Checked specifically for the "await has no effect" warning flagged
  mid-task: not reproducible against the current committed state (`npx
  biome lint` on the touched test files shows only the pre-existing,
  out-of-scope `Bun` global false-positive already present in
  `tests/gepa/capture-tee.test.ts` before this slice — not a new issue).
- `npx biome format` on all touched source/test files → no fixes needed.
- Secret grep on full diff → no matches.
- Full suite (`bun run test`) was **NOT run** per explicit token-discipline
  instruction (3 prior builders this session died running it) — scoped
  tests only, verified by diff/grep otherwise.

## Suggested next handoff
- Reviewer: independent pass on the `source` deviation (Risk #1) — confirm
  the `input.capture_origin` marker approach is acceptable, or direct a
  different mitigation (e.g. wait for a gepa-core enum bump before shipping
  S1, if the reviewer judges that discrepancy blocking rather than
  documented-and-deferred).
- If approved: FEAT-193 S2 (`gepa-corpus-sync`) can proceed once this S1
  bridge is merged — S2 will want to key off `input.capture_origin` for
  now, per Risk #1's follow-up note.
