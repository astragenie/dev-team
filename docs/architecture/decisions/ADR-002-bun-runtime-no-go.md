---
id: ADR-002
title: Bun for dev/CI test runner; Node remains the consumer runtime
status: accepted
introduced_by_slice: null
introduced_at: 2026-06-10
amended_at: 2026-06-10
related_specs: [FEAT-136]
superseded_by: null
---
# ADR-002: Bun for dev/CI test runner; Node remains the consumer runtime

## Context

Workstream 3 (WS3) of the `slice-pipeline-speedup` design
(`docs/superpowers/specs/2026-06-10-slice-pipeline-speedup-design.md`) gated a full Bun
runtime swap behind a one-slice compatibility spike with four exit criteria. ALL four were
required to show green on Windows before proceeding.

Workstream 1 (WS1) had already achieved significant wins: reducing the test suite wall time
from 115.9s to 21.1s on Node 24 by removing per-spawn parse overhead.

The spike was executed 2026-06-10 on Bun 1.3.14 (Windows x64 build).
Amended 2026-06-10 (same day): spike re-run with `bun test --parallel` overturned criterion 1 — 611/611 discovered and passing with `--timeout 30000`, wall 16.5s vs 21.1s node (~22% faster).

### Spike results — initial run

| Criterion | Status | Evidence |
|-----------|--------|----------|
| (1) Test suite under `bun test` | RED | 402 of 611 tests discovered (partial node:test shim; subtest gaps); 23 fail + 22 errors; wall 33.9s vs 21.1s under node |
| (2) crew.ts CLI under bun | GREEN | init/write-handoff round trip; JSON stdout; exit codes all correct |
| (3) e2e-smoke under bun | GREEN | All scenarios passed; wall 1.9s |
| (4) Native TS execution | GREEN | No `--experimental-strip-types` flag needed; bare `bun` execution works |

### Amendment — parallel-mode re-run

User-suggested re-run with `--parallel` (implies `--isolate`, per-file worker processes):

| Criterion | Status | Evidence |
|-----------|--------|----------|
| (1) Test suite under `bun test --parallel --timeout 30000` | GREEN | 611/611 discovered and passing; wall 16.5s vs 21.1s node (~22% faster) |
| (2–4) | GREEN (unchanged) | CLI, e2e, native TS all confirmed |

**Root cause of initial red:** Bun's single-process runner path contains a node:test subtest NotImplementedError that does not exist in parallel mode. The 2 residual failures in the first run were 5s default-timeout artifacts on known-slow tests (12s homedir-fallback scan, 8s redocly lint) that resolved with `--timeout 30000`.

## Decision

We will ADOPT hybrid: use Bun for dev/CI test runner only; Node remains the consumer runtime.

- Development/CI test runner: `npm test` runs `bun test --parallel --timeout 30000` (Bun 1.3+ required for contributors/CI).
- Escape hatch retained: `npm run test:node` (Node-only fallback, not documented for end-users).
- Consumer hooks, CLI on end-user machines (Node require/import): remain on Node 22.6+. No measured win observed in consumer surface; keeping the dual-runtime complexity scoped to dev/CI only minimizes blast radius.
- `--experimental-strip-types` flags: remain in consumer-facing scripts until Node stabilizes type stripping (expected Node 24 or 25 LTS).

## Rationale

**Why the parallel-mode re-run succeeded:**

Bun's single-process runner path contains a node:test subtest NotImplementedError that does not
surface in parallel mode (worker-process isolation). The test discovery gap and error counts in
the initial run were artifacts of this single-process shim gap, not a fundamental incompatibility.
With `--parallel --timeout 30000`, all 611 tests discovered and pass; the 22% wall-time win
(16.5s vs 21.1s on Node) justifies the dev/CI surface swap.

**Why consumer surface stays on Node:**

WS1 removed the primary source of wall-clock loss: per-spawn parse overhead of TypeScript files.
The remaining 21.1s of suite time is real work—subprocess smokes, file-system fixture
provisioning, network timeouts. Crew CLI startup (crew.ts subprocess smokes in validator/deployer)
is ≤0.17s even on Node; no measured win observed there. Adding Bun as an end-user requirement
(consumer hooks, CLI) introduces installation/version management complexity on end-user machines
without a measured ≥30% win. Greenfield status (few consumers at v0.28) noted but not load-bearing
when the user's actual surface (contributor/CI machine) is narrow.

**Why this scope is sustainable:**

Bun 1.3+ for contributors and CI is a low-friction ask (npm install -g bun for local dev; CI
add one bun setup action). The escape hatch (test:node) guards against per-platform Bun regressions.
Full runtime swap can be reconsidered if a consumer-surface win emerges or Bun's maturity stabilizes
further.

## Consequences

### Positive

- **22% test-suite speed gain.** Wall time 16.5s (Bun `--parallel`) vs 21.1s (Node); immediate
  validator gate and fix-bounce turnaround improvement.
- **Zero consumer migration risk.** Hooks on end-user machines remain Node-based; no user-facing
  disruption.
- **Scoped Bun scope.** Dual-runtime complexity limited to dev/CI test runner; consumer surfaces
  unaffected.
- **Escape hatch in place.** `npm run test:node` allows bypass if per-platform Bun regressions
  surface.

### Negative

- Contributor/CI machines must have Bun 1.3+ (or run test:node). Setup cost ~2 min; documented
  in README and contributor guide.
- `--experimental-strip-types` flags remain in consumer scripts until Node stabilizes type
  stripping (expected Node 24 or 25 LTS).

### Neutral

- Bun 1.3.14 proved viable for non-test CLI use (criteria 2–4 green). If future maintenance
  burden arises in consumer surface, the spike evidence provides a rollback story.

## Revisit conditions

**Full runtime swap (consumer surface included) is reconsidered only if:**

Both conditions must be met:

1. **Measured wall-clock win ≥30% on consumer-facing use case** — crew.ts CLI subprocess spawns,
   hook invocation on user machines, or another bottleneck not addressed by test-suite gains.
2. **Bun's node:test implementation passes the full suite in single-process mode on Windows** —
   the subtest NotImplementedError in single-process mode must be closed.

**Escape hatch removal:**

If Bun's single-process node:test shim graduates to full compatibility (criterion 2 above),
the `test:node` escape hatch can be removed; `bun test` can run in either mode based on
parallel vs serial preference.

## Alternatives considered

- **Option A (Full swap):** Use Bun for all dev, CI, and consumer surfaces.
  Rejected in initial spike (criterion 1 red; 33.9s vs 21.1s — slower). Parallel-mode re-run
  showed full suite green, but no measured win on consumer surface observed; blast radius too
  large without consumer-facing benefit.

- **Option B (Hybrid, Bun for dev/CI only):** Keep Node for consumer hooks; use Bun for
  dev/CI test suite.
  Accepted (amended decision). Parallel-mode re-run (16.5s vs 21.1s, ~22% gain) justifies the
  dev/CI swap. Consumer-surface scope remains narrow (Bun 1.3+, escape hatch in place).

- **Option C (Stay on Node):** Revisit only if both full-swap conditions hold.
  Rejected; parallel-mode results showed criterion 1 achievable and measurable (though not full
  30% gate for consumer swap).

## References

- **Parent spec:** `docs/superpowers/specs/2026-06-10-slice-pipeline-speedup-design.md`
  (WS1 and WS3 sections)
- **WS1 evidence:** `CHANGELOG.md` entry v0.28.1 (test suite optimization)
- **Spike execution:** 2026-06-10, Bun 1.3.14 (installed via `npm install -g bun`)
- **Related decisions:** DEC-011 (stdin.resume pattern in async hooks, Node-focused)
