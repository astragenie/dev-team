---
id: FEAT-199
status: done
started_at: 2026-07-08
closed: 2026-07-08
closure: "199a (grade-rot gate) + 199b (backfill 22 grandfathered grades, 0 unrecoverable, audit-verified no fabrication) both landed on stabilization/e2e-wave. validate-syntheses reports 0 grade rot. Followup (not blocking close): validate-syntheses runs ADVISORY — promote the grade-check to a HARD CI step so new rot fails red (AC-4 hard-block), a small test.yml change coordinated with FEAT-200."
progress: "199a (grade-placeholder rejection gate) LANDED on stabilization/e2e-wave — validate-syntheses.ts now rejects placeholder/all-zero/unfilled-template grade files, pre-2026-07-08 rot grandfathered (logged, not hard-fail). Review approved_with_notes. NOTE: validate-syntheses runs as an ADVISORY CI validator, so 199a detects+lists rot but does not yet fail CI red on NEW rot (AC-4 hard-block) — promoting the grade check to a HARD step is a small test.yml followup (coordinate with FEAT-200's test.yml ownership). REMAINING: 199b backfill (rewrite ~22 grandfathered grade files, gated/human-review, runs after 199a) — see the Deferred section."
priority: P1
category: feature
target_release: null
created: 2026-07-08
updated: 2026-07-08
depends_on: []
slices: []
derived_from: null
pm_customer_impact: 0.75
pm_effort_estimate: 0.35
pm_strategic_alignment: 0.75
pm_technical_risk: 0.65
pm_dependency_depth: 0.2
pm_composite_priority: P1
pm_autonomous_safe: false
pm_reviewed: 2026-07-08
autonomous_safe: false
triage_notes: "technical_risk 0.65, band 0.6-0.8 (data-shape correction across ~20+ already-committed grade artifacts, rollback needs a reconcile step not a blind revert, plus a new HARD CI gate wired into .github/workflows/test.yml). composite_score=0.6925 -> P1 via (impact>=0.7 AND alignment>=0.6); pre-mortem mandatory via both P1 and risk>=0.6. autonomous_safe=false: technical_risk (0.65) exceeds the 0.6 gate and this wires a new step into the HARD CI gate file -- human-in-loop required per repo convention."
---
## Description

Enforce grade-placeholder rejection in CI plus backfill — promote validate-syntheses placeholder rejection to grade files as a HARD CI gate so no new placeholder or all-zero grade rot lands, and do a one-time sweep of the existing 27 percent placeholder / 21 percent all-zero grade files. Makes the grade signal trustworthy (feeds every downstream loop decision).

## Intake notes

Created via free-text intake (`/runner:intake "<text>"`). Priority is
unset — this FEAT has not been scored yet. Run `/runner:triage`
(PM scoring + `backlog pm-apply`) to score it before slicing.
## Acceptance criteria

_Slice 199a (gate logic — parallel, this wave). `scripts/validate-syntheses.ts` is ALREADY a HARD CI step (`.github/workflows/test.yml:30`), so extending its logic activates the gate with NO workflow edit — 199a owns only `scripts/validate-syntheses.ts` + its test._

- AC-1: Given a grade file under `.claude/artifacts/loop/grades/` containing placeholder content (a `bullet`/`bullet N` literal in a required prose field, an unfilled `<fill …>`/`TBD` token, OR every dimension score `0`), When `scripts/validate-syntheses.ts` runs, Then it exits non-zero and lists every offending grade file path with the reason.
- AC-2: Given a grade file with real, non-placeholder content and non-zero dimension scores, When the same validator runs, Then it exits 0 and does not flag the file. (Regression fixtures: a known-good grade like `20260708T081627Z-slice110-grade.md` passes; a synthetic placeholder grade fails.)
- AC-4: Given `validate-syntheses.ts` already runs as a HARD CI step (`test.yml:30`), When a PR introduces a placeholder/all-zero grade file, Then CI fails red on that PR — closing the gap that let the placeholder/all-zero rot accumulate silently. NO `.github/workflows/test.yml` edit required (the step exists; only the validator's grade-file coverage is new). Directly targets the weak `test_confidence` + `observability` grade dimensions.

## Deferred — slice 199b (backfill; GATED, human-review; runs AFTER 199a merges)

Not part of the parallel wave — rewrites ~20+ already-committed grade artifacts (`.claude/artifacts/loop/grades/`), which is not a clean `git revert`. Run only after 199a's gate is live, so backfilled grades must pass the new gate.

- AC-3: Given the current grade files with a confirmed placeholder pattern (SLICE-94/95 verified), When the one-time backfill runs, Then every previously-flagged file is either regenerated with real, source-cited content OR explicitly annotated `backfill_status: unrecoverable` with a reason, and a before/after summary report is written under `.claude/artifacts/loop/`.
