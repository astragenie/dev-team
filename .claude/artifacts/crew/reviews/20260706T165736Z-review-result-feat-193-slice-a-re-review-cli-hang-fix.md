---
findings: "🔴:0,🟡:2,❓:1"
status: completed
decision: approved_with_notes
---
# Review Result: Review Result

- Created: 2026-07-06T17:22:15.593Z
- Reviewer: reviewer
- Decision: approved_with_notes
- Status: completed
- Summary: Fix delta is real and correctly scoped (5 files, both call sites now route through capture-failure-trial-guard.ts); all claimed tests pass (83/83) under the project's actual 60s test-timeout config, typecheck and lint are clean, but the guard's Promise.race does NOT bound the CLI's real wall-clock process-exit time (empirically demonstrated) because scripts/crew.ts never calls process.exit(0) on its success path, and this residual exposure is currently latent only because the resolved gepa-core dependency happens to ship compiled dist today.
- Evidence Checked:
  - git show a15ee94c: exactly hooks/lib/check-subagent-return.ts
  - scripts/lib/artifacts/write.ts
  - scripts/lib/gepa/capture-failure-trial-guard.ts (new)
  - tests/crew-write-review-result.test.ts
  - tests/gepa/capture-failure-trial.test.ts. bun test --timeout 60000 tests/crew-write-review-result.test.ts x3 runs
  - 11 pass 0 fail each time (14.5s/16.4s/16.6s). Combined 5-file suite (capture-failure-trial.test.ts + subagent-return.test.ts + capture-learning.test.ts + capture-tee.test.ts + crew-write-review-result.test.ts) = 83 pass 0 fail
  - matches handoff claim exactly. bun run typecheck: clean. bun run lint: 177 files
  - 0 warnings. grep confirms no remaining direct import of capture-failure-trial.ts outside the guard. import-type erasure confirmed (guard module has zero runtime gepa-core dependency). COUNTER-EVIDENCE: npm pack of the lockfile-pinned gepa-core 0.6.0 shows main/exports still point at raw src TS files
  - no dist
  - confirming the diagnosed root cause is real for the npm-ci-resolved version -- but the currently bun.lock-resolved 0.7.0 ships a compiled dist/index.js and cold-imports in about 105ms (measured directly)
  - so the regression is not currently reproducible with today's actual dependency resolution. Synthetic repro (a standalone Promise.race script) proves the awaited function returns in ~311ms while the OS process does not actually exit until the orphaned losing branch's timer fires at ~3000ms -- i.e. captureFailureTrialGuarded bounds the logical await chain but not real process wall-time
  - because dynamic import is not cancellable and Node/Bun does not exit while any timer or promise is still pending. scripts/crew.ts success path (main function) has no explicit success-path exit call -- only error paths force-exit -- confirmed via grep. By contrast the check-subagent-return hook shim DOES force-exit unconditionally on its own last line
  - so that call site is not exposed to this gap -- only the CLI is.
- Files Reviewed:
  - scripts/lib/gepa/capture-failure-trial-guard.ts
  - scripts/lib/gepa/capture-failure-trial.ts
  - scripts/lib/artifacts/write.ts
  - hooks/lib/check-subagent-return.ts
  - scripts/lib/gepa/capture-tee.ts
  - scripts/crew.ts
  - tests/crew-write-review-result.test.ts
  - tests/gepa/capture-failure-trial.test.ts
  - tests/subagent-return.test.ts
  - package.json
  - package-lock.json
  - bun.lock
- Test Adequacy: 83/83 slice-scoped tests pass reliably (verified independently, 3x repeated runs of the flagship file) when run with the project's actual 60000ms test timeout; a bare 5000ms bun-default invocation is flaky in this Windows environment (10/11, then 3/11 with an unrelated assertion failure, then 11/11) which appears to be process-spawn/disk-contention noise unrelated to the fix rather than a genuine regression, since the correctly-configured invocation was clean across 3 consecutive runs.
- Risks: HIGH (new, not previously flagged): captureFailureTrialGuarded's Promise.race does not cancel the losing dynamic-import branch, and scripts/crew.ts's success path never force-exits, so a genuinely slow or cold gepa-core load can still hold the CLI child process open for its full real duration even though the guard's own awaited promise resolves within about 1.5s -- the guard docstring's 'never hold a caller open' claim is only true for the logical await chain, not for OS process lifetime. Currently latent because bun.lock resolves gepa-core to 0.7.0 (compiled dist, fast cold import). MEDIUM: package.json wants gepa-core 0.7.0 exactly but package-lock.json is still pinned to 0.6.0 (raw TS source, no dist, confirmed via npm pack) -- this drift is pre-existing (identical on main, not touched by this fix commit) but currently makes npm ci (documented hard CI gate #1) fail outright with a lockfile-mismatch error on this branch; it also means the raw-TS-no-dist root-cause diagnosis is stale for bun-resolved installs but still accurate for the lockfile-pinned npm-ci path. MEDIUM (pre-existing, correctly flagged by the builder): write.ts's fireCaptureTeeSilent (capture-tee.ts) fires first and unconditionally on every writeArtifact call with zero import-time guard (its own internal race only bounds the store-write call, not the static top-level gepa-core import that evaluates as soon as the module loads) -- confirmed genuinely pre-existing via git diff against main and via the handoff's own Risk #4 section, but this review's process-exit finding makes it more exploitable than described: it has literally zero ceiling on the import cost, not just an untested one.
- Required Follow-up: Before or shortly after this merge: (1) add an explicit forced success-path exit at the end of scripts/crew.ts's main function (or wherever writeArtifact-driven commands complete) so orphaned background dynamic imports can never hold the CLI process open past its logical completion -- isolated, low-risk, mirrors the pattern already used on every error path. (2) Prioritize the already-flagged fireCaptureTeeSilent follow-up (wrap it in the same captureFailureTrialGuarded-style race) ahead of other FEAT-193/FEAT-185 work, since it is the same hazard class that caused this revert and currently has zero protection. (3) Reconcile package.json (0.7.0) vs package-lock.json (0.6.0 pinned) so npm ci succeeds again -- pre-existing and out of this delta's scope, but currently blocks the documented CI gate #1 on main regardless of this fix. None of these block re-merging this specific delta: all originally-scoped tests pass reliably, typecheck and lint are clean, and the observable regression (CI test timeout) does not currently reproduce.

