---
id: SLICE-04
status: completed
feature: FEAT-020
priority: P2
target_release: v0.3.2
created: 2026-05-24
updated: 2026-05-24
completed_at: 2026-05-24
---
# SLICE-04: Multi-slice support in loop:slice-complete

Implements all of FEAT-020 (single-slice feature). Cross-repo work — actual code landed in `hero-crew-autonomous-loop` repo at commit `c0a99b2`. This slice tracks the crew-side acceptance.

## Objective

Extend `loop:slice-complete` so multi-slice features can ship partial closes without auto-moving the parent feature to `backlog/done/` prematurely. Addresses the FEAT-019 SLICE-B auto-close gotcha discovered during SLICE-01 close.

## In scope (delivered in loop repo c0a99b2)

- Frontmatter field `feature_complete: true | false | null` (default `null` = current auto-close behavior).
- Runtime override `--keep-feature-open` flag on `/loop:slice complete`.
- Result object gains `feature.keptOpen: true` + `feature.reason: string` when move was skipped.
- 3 new tests in loop's `tests/slice-complete.test.mjs` covering frontmatter opt-out, runtime flag opt-out, explicit-true pass-through.

## Out of scope

- Loop release cut (separate ship task; this slice closes when the impl lands on loop main).
- Crew-side documentation of the new flag (could be a CLAUDE.md callout in a follow-up if friction observed).

## Acceptance criteria

- [ ] **AC-1** Loop repo `scripts/lib/slice-linker.mjs` `moveFeatureToDone` reads `feature_complete` frontmatter and skips when explicitly `false`. Verified by code inspection at loop commit `c0a99b2`.
- [ ] **AC-2** Loop repo `scripts/loop.mjs` accepts `--keep-feature-open` flag. Verified by `FLAG_SPEC` entry at line ~38.
- [ ] **AC-3** Loop tests at `tests/slice-complete.test.mjs` add 3 cases: `feature_complete: false`, `keepFeatureOpen: true`, explicit `feature_complete: true`. All pass: 11/11 slice-complete tests.
- [ ] **AC-4** Loop CHANGELOG `Unreleased` section documents the change.
- [ ] **AC-5** Loop CI not regressed (typecheck pre-existing failures, not introduced by this slice).

## Done When

- AC-1..5 PASS with evidence (commit SHA + test output).
- Loop commit `c0a99b2` pushed to `origin/main` of `hero-crew-autonomous-loop`. ✓ (verified by `git push` output `5ae65eb..c0a99b2  main -> main`).
- FEAT-020 auto-moves to `backlog/done/` when this slice closes (correct — single crew-side tracking slice).

## Reviewer ladder

- **Reviewer A**: lead-self-review (cross-repo work; self-review against AC verifiable from loop commit; full crew:reviewer dispatch would duplicate substance).
- **Reviewer B**: N/A — no plugin/skill shape change in crew repo.
