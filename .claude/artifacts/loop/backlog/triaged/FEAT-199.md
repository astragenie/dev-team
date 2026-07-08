---
id: FEAT-199
status: triaged
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
## Acceptance criteria (Given-When-Then)

- AC-1: Given a grade file under `.claude/artifacts/loop/grades/` containing placeholder content (every field the literal string `bullet`, or every dimension score `0`), When the extended validator (grown from scripts/validate-syntheses.ts's existing placeholder-rejection pattern) runs, Then it exits non-zero and lists every offending file path.
- AC-2: Given a grade file with real, non-placeholder content and non-zero dimension scores, When the same validator runs, Then it exits 0 and does not flag the file.
- AC-3: Given the current backlog of 80 grade files with a confirmed placeholder pattern (SLICE-94/95 verified directly) (edge/failure path), When the one-time backfill script runs, Then every previously-flagged file is either regenerated with real, source-cited content or explicitly annotated `backfill_status: unrecoverable` with a reason, and a before/after summary report is written under `.claude/artifacts/loop/`.
- AC-4: Given the new validator wired into `.github/workflows/test.yml` as a HARD CI step, When a new PR introduces a placeholder or all-zero grade file, Then CI fails red on that PR -- closing the gap that let the current placeholder/all-zero rot accumulate silently, and directly targeting the weak `test_confidence` (0.548) and `observability` (0.496) grade dimensions by making the grade signal itself enforced and inspectable.
