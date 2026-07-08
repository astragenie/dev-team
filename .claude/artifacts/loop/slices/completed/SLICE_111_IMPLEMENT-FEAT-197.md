---
id: SLICE-111
title: Implement FEAT-197
status: completed
feature: FEAT-197
phase: null
priority: P2
target_release: null
requires_validation: true
risk: medium
created: 2026-07-08
updated: 2026-07-08
completed_at: 2026-07-08
badges: [serial-reviewer-warning]
---
# SLICE-111: Implement FEAT-197

Implements FEAT-197. See [feature file](../../../backlog/in-progress/FEAT-197.md) for product context.

## Objective

Full slice-ceremony e2e — drive the whole ceremony (slice start to build to review to validate to close) against the sample/temp repo and assert: artifacts land in .claude/artifacts/crew, workflow-state currentRun rotates, cost attribution attaches, and slice file moves to completed. Catches ceremony regressions that unit tests miss today.

## In scope

- bullet 1
- bullet 2

## Out of scope

- bullet 1

## Acceptance criteria

- [ ] AC-1: Given a hermetic temp repo seeded with a triaged FEAT that has at least one `## Acceptance criteria` bullet, When `slice start --id FEAT-X` runs against it, Then a SLICE file is created under slices/pending, `workflow-state.json.currentRun` rotates to that slice, and a run-brief artifact is written under `.claude/artifacts/crew/runs/`.
- [ ] AC-2: Given a started slice with a review artifact (`decision: PASS`/approved) and a validation artifact (PASS) present, When `slice complete --id SLICE-X` runs, Then `reviewGate.satisfied` and `validationGate.satisfied` are both true, the slice file moves slices/pending → slices/completed, and the feature moves backlog/in-progress → backlog/done.
- [ ] AC-3: Given `slice complete` ran, When cost auto-emit fires, Then a cost-report artifact is written under `.claude/artifacts/crew/cost/` scoped to the rotated `currentRun` (attribution attaches to SLICE-X, not a stale window).
- [ ] AC-4: Given `slice grade --id SLICE-X` runs, When the grade file is created, Then its frontmatter back-links both `slice: SLICE-X` and the originating `feature:` (non-null) and the scores block is present.
- [ ] AC-5: Given the ceremony e2e harness, When it runs via the e2e-smoke entry (blocking-gate convention), Then it exits non-zero if any ceremony step fails to produce its expected artifact or state transition (start/complete/grade), consistent with existing e2e-smoke.ts asserts.

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-197 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
