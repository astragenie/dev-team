---
id: ADR-002
title: Stay on Node — Bun runtime swap is a no-go
status: accepted
introduced_by_slice: null
introduced_at: 2026-06-10
related_specs: [FEAT-136]
superseded_by: null
---
# ADR-002: Stay on Node — Bun runtime swap is a no-go

## Context

Workstream 3 (WS3) of the `slice-pipeline-speedup` design
(`docs/superpowers/specs/2026-06-10-slice-pipeline-speedup-design.md`) gated a full Bun
runtime swap behind a one-slice compatibility spike with four exit criteria. ALL four were
required to show green on Windows before proceeding.

Workstream 1 (WS1) had already achieved significant wins: reducing the test suite wall time
from 115.9s to 21.1s on Node 24 by removing per-spawn parse overhead.

The spike was executed 2026-06-10 on Bun 1.3.14 (Windows x64 build).

### Spike results

| Criterion | Status | Evidence |
|-----------|--------|----------|
| (1) Test suite under `bun test` | RED | 402 of 611 tests discovered (partial node:test shim; subtest gaps); 23 fail + 22 errors; wall 33.9s vs 21.1s under node |
| (2) crew.ts CLI under bun | GREEN | init/write-handoff round trip; JSON stdout; exit codes all correct |
| (3) e2e-smoke under bun | GREEN | All scenarios passed; wall 1.9s |
| (4) Native TS execution | GREEN | No `--experimental-strip-types` flag needed; bare `bun` execution works |

**Gate outcome:** Three of four criteria passed, but criterion (1) is the gate-holding signal.
Because WS3 was designed to test whether Bun could replace Node in the **dev/CI surface**,
and that surface **is the test suite**, the spike result is **do NOT proceed**.

## Decision

We will NOT swap to Bun for any surface:
- Development scripts remain on Node 22.6+ (`--experimental-strip-types`).
- CI (`npm test`, `npm run typecheck`) remains on Node.
- Consumer hooks (end-user machines, Node require/import) remain on Node.
- The spec's hybrid fallback (Bun for dev/CI only) is also **rejected**.

## Rationale

**Why the hybrid fallback is also rejected:**

The failing criterion IS the dev/CI surface—the test suite. Bun's node:test compatibility
remains incomplete on Windows as of 1.3.14 (subtest gaps, discovery failures, error handling).
A "hybrid" approach (Bun for some scripts, Node for others) would require end-user documentation
and cross-platform testing burden for no measured wall-clock benefit.

**Why the swap buys nothing:**

WS1 removed the primary source of wall-clock loss: per-spawn parse overhead of TypeScript files.
The remaining 21.1s of suite time is real work—subprocess smokes, file-system fixture
provisioning, network timeouts—which a runtime swap cannot compress. Bun shows no measured
advantage on this repo's suite (33.9s vs 21.1s is a regression, not a win).

**Consumer-facing risk without measured benefit:**

Adding Bun as an end-user requirement (consumer hooks, CLI) introduces installation/version
management complexity on end-user machines. Without a measured ≥30% win, that risk outweighs
the benefit.

## Consequences

### Positive

- **Zero consumer migration risk.** Hooks on end-user machines remain Node-based.
- **Single runtime story.** Node 22.6+ with `--experimental-strip-types` remains the only
  production-grade requirement.
- **No breaking changes.** Existing consumers do not need to install or manage Bun versions.
- **Simpler CI.** GitHub Actions workflows stay Node-focused; no cross-platform Bun triage.

### Negative

- `--experimental-strip-types` flags remain in scripts until Node stabilizes type stripping
  (expected Node 24 or 25 LTS).
- Test suite cannot leverage Bun's TS native execution or potential future optimizations.

### Neutral

- Bun 1.3.14 proved viable for non-test CLI use (criterion 2 and 3 green). If future maintenance
  burden arises in this area, the spike evidence provides a fallback story.

## Revisit conditions

Both conditions must be met to reconsider:

1. **Bun's node:test implementation discovers and passes the full suite on Windows** — the partial
   shim and subtest gaps must be closed.
2. **Measured wall-clock win ≥30% over the then-current Node baseline** on this repo's suite.
   (Relative benchmark, not absolute; the bar updates with Node LTS releases.)

If Bun node:test graduates to full compatibility and a clear speedup appears, this decision may
be revisited. Until both conditions hold, stay on Node.

## Alternatives considered

- **Option A (Full swap):** Use Bun for all dev, CI, and consumer surfaces.
  Rejected: criterion (1) failed; no measured win.

- **Option B (Hybrid, Bun for dev/CI only):** Keep Node for consumer hooks; use Bun for
  local scripts and CI.
  Rejected: the failing criterion IS the dev/CI surface; hybrid adds complexity (docs,
  per-platform triage) without benefit.

- **Option C (Stay on Node, revisit on signal):** Current decision. Revisit when both
  conditions in "Revisit conditions" hold.
  Accepted.

## References

- **Parent spec:** `docs/superpowers/specs/2026-06-10-slice-pipeline-speedup-design.md`
  (WS1 and WS3 sections)
- **WS1 evidence:** `CHANGELOG.md` entry v0.28.1 (test suite optimization)
- **Spike execution:** 2026-06-10, Bun 1.3.14 (installed via `npm install -g bun`)
- **Related decisions:** DEC-011 (stdin.resume pattern in async hooks, Node-focused)
