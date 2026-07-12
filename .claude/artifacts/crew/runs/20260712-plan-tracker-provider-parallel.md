# Parallel execution plan — tracker-provider program (v2 plan, waves)

**Date:** 2026-07-12
**Source design:** `.claude/artifacts/crew/designs/2026-07-12-tracker-provider-transition-plan.md` (v2, dual-review approved)
**Invariants:** repo isolation = free parallelism; same-file-area work serializes; every
builder in its own worktree; draft-PR-first + report-early + SendMessage backstop; 200k
token cap per slice; sensitive-path PRs (`agents/`, `commands/`, `hooks/`, workflows)
never auto-merge — orchestrator merges after review PASS (#230 gate).

## Collision map

| Track | Repo | File area | Depends on |
|---|---|---|---|
| **W-A** #227 recovery (report-to-PR helper + 4 builder prompts) | dev-team | `scripts/report-to-pr*`, `agents/{fullstack,backend,frontend,aiplugin}-dev.md` | — (worktree `3cfb0bb0` exists) |
| **W-B** dispatcher liveness poll (v2 §8) | dev-team | `commands/build.md`/`parallel.md` + dispatcher script | W-A semantics (spec'd in v2 — buildable against spec) |
| **W-C** ReviewChannel helper (GitHub impl, thin `gh`) | dev-team | new `scripts/lib/review-channel*` + tests | — |
| **W-D** reviewer prompt conversion (verdict→PR review, `needs-fix` label) | dev-team | `agents/reviewer*.md`, `csharp/typescript-reviewer.md` | **W-C API** |
| **W-E** architect doc-in-feature pattern (Phase 2) | dev-team | `agents/architect.md`, `architect-reviewer.md`, `document-writer.md` | — |
| **W-F** slice-sizing port, 200k cap (v2 §14) | dev-team | dispatch/estimator scripts (new) | — |
| **W-G** review-depth telemetry tripwire (v2 §12) | dev-team | new metrics script | — (check overlap with W-F at dispatch) |
| **W-H** Phase 5 scoping (two-way-sync FEAT) | any | read-only research + FEAT file | — |
| **R-A** #435 Linear auth/config | runner | `linear-config.mts`, schema | — |
| **R-B** #437 Linear GraphQL writes | runner | `linear-graphql.mts` | R-A (semantic: writes need auth) |
| **R-C** #439 warning-stubs + smoke | runner | stubs/tests | R-B |
| **R-D** Phase 4.5 syncPull wiring | runner | scheduler/workflow area | — |
| **P-A** Phase 3 extraction (ONE-WAY DOOR) | plugins-common | new package | W-C+W-D proven + **user sign-off** + own session |
| **D-A** dev-team Linear auth slice | dev-team | new config surface | P-A (consumes shared package) |

## Critical path

**W-C → W-D → P-A → D-A.** Everything else hangs off waves. Wall-clock = this chain.

## Waves (cap ~5 concurrent builders — review-cycle bandwidth is the real limit; today's NEEDS_FIX rate was 3/4 and each cycle costs orchestrator attention)

### Wave 1 — 5 builders + 1 researcher, zero collisions
| | Track | Size |
|---|---|---|
| 1 | W-A #227 recovery | S (mostly done, finish gates + draft PR) |
| 2 | W-C ReviewChannel helper | M |
| 3 | W-F slice-sizing port | M |
| 4 | R-A Linear auth (runner) | S-M |
| 5 | R-D syncPull wiring (runner) | S |
| 6 | W-H Phase 5 scoping (read-only researcher, cheap) | S |

### Wave 2 — starts as Wave-1 capacity frees
| | Track | Gate |
|---|---|---|
| 1 | W-D reviewer conversion | after W-C merges |
| 2 | W-B liveness poll | after W-A merges (or against spec if W-A drags) |
| 3 | W-E architect doc pattern | none — promote INTO Wave 1 if a slot frees early |
| 4 | R-B Linear writes (runner) | after R-A |
| 5 | W-G telemetry | none (verify no W-F file overlap) |

### Wave 3 — serial tail
| | Track | Gate |
|---|---|---|
| 1 | **P-A extraction** — own plugins-common session, user signs the one-way door first | W-C+W-D live |
| 2 | R-C stubs+smoke (runner) | after R-B |
| 3 | D-A dev-team Linear auth | after P-A |

### Continuous
Phase-1/2 PRs land → reviewers start using ReviewChannel themselves (dogfood);
telemetry (W-G) watches for review-depth regression from day one.

## ETA compression

Serial estimate was ~4-5 sessions (+30% review cycles). Parallel: wall-clock =
critical path W-C→W-D→P-A→D-A ≈ **2–2.5 focused sessions**; Wave 1's breadth
(W-A/W-F/R-*) completes inside session 1. Phase 5 remains unscoped and excluded.

## Risk controls

- Max 5 concurrent builders — orchestrator review/merge bandwidth is the bottleneck,
  not builder capacity. Do not raise it; today's data says every extra live PR is
  half a review cycle of queue.
- Every dev-team track here touches `agents/` or `commands/` → sensitivity gate
  holds every PR for orchestrator merge. This is intended, not friction.
- P-A does NOT start without explicit user sign-off recorded (one-way door, v2 §11).
- runner chain (R-A→R-B→R-C) may alternatively run through runner's own loop —
  decide at Wave-1 dispatch; do NOT run both paths against the same branch.
- Death protocol: any builder death → check its worktree/PR before re-dispatch
  (work usually survives; 7/7 today had intact work).
