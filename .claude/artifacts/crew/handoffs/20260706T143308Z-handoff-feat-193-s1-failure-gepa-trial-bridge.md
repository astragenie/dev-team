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
IN-PROGRESS handoff → ready for review (all planned AC work committed;
one architecture deviation flagged below needs reviewer sign-off).

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

3. **Real regression caught + fixed pre-handoff**: my first wiring attempt
   used a static top-level `import { captureFailureTrial } from
   "../../scripts/lib/gepa/capture-failure-trial.ts"` in
   `check-subagent-return.ts`. That file is invoked via plain `node
   --experimental-strip-types` (not bun) by the real hook shim
   (`hooks/check-subagent-return.ts`) — and the installed
   `@astragenie/gepa-core` package's `main`/`exports` point at raw `.ts`
   source (not a compiled `dist/`), which Node explicitly refuses to
   type-strip under `node_modules`
   (`ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`). A static import crashed
   the *entire hook module load*, not just the capture call — caught by 2
   failing spawn-based smoke tests in `tests/subagent-return.test.ts`
   (`bun test` transpiles everything itself so in-process tests didn't
   catch it; only the `spawn("node", ...)` tests did). Fixed by switching
   to a dynamic `import()` wrapped in try/catch (`fireFailureTrialSilent`),
   matching the pattern `scripts/lib/artifacts/write.ts`'s
   `fireCaptureTeeSilent` already uses for the identical hazard. Verified
   fixed: 0 failures across all 81 slice-scoped tests post-fix.

4. **`hooks/lib/check-subagent-return.ts` has no reliable agent identity**
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
- `bun test tests/gepa/capture-failure-trial.test.ts tests/subagent-return.test.ts tests/capture-learning.test.ts tests/crew-write-review-result.test.ts tests/gepa/capture-tee.test.ts` → **81 pass, 0 fail** (40 expect() calls).
- `bun run typecheck` → clean.
- `bun run lint` (scripts/ + hooks/) → clean, 0 warnings.
- `npx biome format` on all 7 touched source/test files → no fixes needed.
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
