# Task Handoff: FEAT-188 S4 astramem paired-test flake — root cause + fix (issue #170)

- Created: 2026-07-06T23:22:19.672Z
- From: researcher
- To: dispatcher
- Objective: Flake reproduces via the real bun run test script (no --parallel needed) and is a downstream symptom of the repo's known Bun bun#5090 node:test cascade, not raw HTTP-under-load starvation; fix by removing the real socket from the paired tests via an in-memory fake wire provider.
- Allowed Scope:
  - Read-only investigation of astragenie/dev-team#170 on branch worktree-agent-a140c7c1a6c668a36 (worktree agent-a140c7c1a6c668a36): reproduced the full bun run test suite
  - traced the paired astramem test failure
  - checked package.json/CLAUDE.md/bunfig.toml for --parallel drift
  - checked for other in-process-server tests
  - and evaluated 3 candidate fixes. No code was edited.
- Forbidden Scope: -
- Deliverable: Findings doc at docs/research/2026-07-06-s4-astramem-parallel-flake-investigation.md: confirmed repro (57 fail/55 errors, 93s, 180 files) via the actual 'bun run test' script -- no --parallel flag needed, contradicting CLAUDE.md's stale --parallel guidance (real script had --parallel removed in a20f9dd9 specifically to fix bun#5090, an ancestor of this branch). 53 occurrences of bun#5090 NotImplementedError in the same run, including tests/telemetry-hook-flush.test.ts (the only other in-process http.Server test), which aborts outright from the same bug -- corroborated independently by a same-day unrelated review artifact. Hypothesis grid rules out 'health-probe silently fails' (falsified by the already-tried direct-fetch injection seam) and frames the leading hypothesis as: astramem's fire-and-forget remember() is a downstream casualty of the same single-process node:test scheduling corruption, not a standalone HTTP/socket contention problem. CI reproduction on the Linux runner is inferred likely but UNVERIFIED (workflow definition lives in sibling repo astragenie/common, not available). Recommended fix: replace startFakeLocalDaemon's real socket with an in-memory fake AstramemWireProvider injected via the existing __resolveRemote seam for the 2 routing/dual-write tests (small effort, ~1 file); optionally keep one isolated real-daemon wire-fidelity test run outside the full suite. Also flags a separate, non-blocking doc-drift bug: CLAUDE.md still documents --parallel for bun run test on both main and this branch, years after package.json removed it.
- Changed Files:
  - docs/research/2026-07-06-s4-astramem-parallel-flake-investigation.md
  - tests/memory-provider-astramem.test.ts
  - scripts/lib/memory/astramem-provider.ts
  - CLAUDE.md
  - package.json
- Confidence: medium
- Risks: Causal link between astramem's silent remember()-drop and the bun#5090 cascade is correlational (same run, same file class as telemetry-hook-flush.test.ts), not proven with in-process instrumentation -- confirming it would require a temporary code edit (out of read-only scope). CI-runner reproduction is inferred, not confirmed (workflow lives in astragenie/common). Recommended fix trades away real-daemon wire-shape fidelity unless the optional isolated smoke test is kept.
- Suggested Next Handoff: Dispatch crew:fullstack-dev or crew:test-automator to implement the in-memory-fake-provider fix in tests/memory-provider-astramem.test.ts per the findings doc's recommended-fix section, then crew:reviewer + crew:validator per normal gate; separately, a cheap doc fix to CLAUDE.md removing stale --parallel references can ride along or go out as a fast-follow.

