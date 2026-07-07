---
findings: "🔴:0,🟡:0,❓:1"
status: completed
decision: approved_with_notes
---
# Review Result: Review Result

- Created: 2026-07-07T08:59:51.425Z
- Reviewer: reviewer
- Decision: approved_with_notes
- Status: completed
- Summary: Capture-guard latency fix (5f32f33b) is correct and production-inert; detach+guard design is sound and both fire-and-forget paths already self-swallow errors, so no unhandledRejection risk despite trackDetached not catching defensively.
- Evidence Checked:
  - Read full diff (write.ts
  - capture-failure-trial-guard.ts
  - guarded-fire.ts
  - 4 test files). Confirmed fireGuarded try/catches all errors (never rejects); confirmed fireFailureCaptureSilent has its own 2 nested try/catch blocks around both awaits
  - so trackDetached's un-caught .finally() is currently safe given both tracked promises never reject. Grepped all writeArtifact call sites (scripts/crew.ts x8
  - cost-hygiene x3) — all use 3-arg form
  - zero overrides passed in production; __captureTeeLoader/__guardTimeoutMs/__drainPendingCaptures appear only in 3 test files + the definition file
  - confirming production inertness (mirrors astramem-provider.ts __resolveRemote pattern). Re-ran tests/gepa/guarded-fire.test.ts standalone: 5 pass in 154ms total including the child-process-spawn regression test (spawns real bun process
  - asserts elapsed <3000ms) — sanity-confirms the unref() wall-time-bound claim empirically
  - no force-kill/hang in any test (all race against real setTimeout-backed competitors per the documented Bun/Windows unref pitfall). Verified writeArtifact's repoContext block
  - isCostReportKind skip gate
  - and registerWorkflowArtifact ordering are byte-identical pre/post-diff — only the two capture calls changed from inline-await to trackDetached.
- Files Reviewed:
  - scripts/lib/artifacts/write.ts
  - scripts/lib/gepa/capture-failure-trial-guard.ts
  - scripts/lib/gepa/guarded-fire.ts (new)
  - tests/gepa/guarded-fire.test.ts (new)
  - tests/gepa/write-artifact-capture-guard.test.ts (new)
  - tests/gepa/capture-parity.test.ts
  - tests/gepa/capture-absent-parity.test.ts
- Test Adequacy: Full suite: 1720 pass / 117 skip / 3 fail (96.4s). The 3 fails are tests/telemetry-plugin-cache-smoke.test.ts, unrelated to this diff — ENOENT scanning the worktree's node_modules, which does not exist at all in this worktree (pre-existing infra gap, not caused by 5f32f33b). All gepa/capture/guard-related tests (1720 incl. new TDD suites) pass. typecheck clean (tsc --noEmit, exit 0), lint clean (biome, 0 warnings across 194 files), format:check clean (382 files).
- Risks: LOW: trackDetached() (write.ts) does 'void capture.finally(...)' without its own .catch — safe today only because both tracked call sites (fireCaptureTeeSilent via fireGuarded, fireFailureCaptureSilent via its own nested try/catch) are structurally guaranteed to never reject; a future writeArtifact capture call site that forgets this invariant would produce a process-level unhandledRejection. Separately, the worktree has no node_modules installed at all, which is why telemetry-plugin-cache-smoke.test.ts fails — not a code defect but should be fixed before this worktree's CI run is treated as a clean signal.
- Required Follow-up: Optional hardening: add a defensive .catch(() => {}) inside trackDetached() so the fire-and-forget contract is enforced structurally rather than by convention across call sites. Run npm ci / bun install in the wave1-feat188-closeout worktree so the full suite reports a true 1723/1723 green before this lands.

