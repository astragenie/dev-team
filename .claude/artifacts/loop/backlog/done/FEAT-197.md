---
id: FEAT-197
status: done
priority: P2
category: feature
target_release: null
created: 2026-07-08
updated: 2026-07-08
depends_on: []
slices: [SLICE-111]
derived_from: null
pm_customer_impact: 0.6
pm_effort_estimate: 0.55
pm_strategic_alignment: 0.75
pm_technical_risk: 0.45
pm_dependency_depth: 0.3
pm_composite_priority: P2
pm_autonomous_safe: false
pm_reviewed: 2026-07-08
autonomous_safe: false
triage_notes: "technical_risk 0.45, band 0.3-0.5 (new e2e pattern in repo -- orchestrating the full ceremony has no existing analog -- but test-only, no schema/contract change, clean git revert). composite_score=0.615; neither P1 branch fires (impact 0.60 < 0.7; alignment 0.75 < 0.8) -> P2. autonomous_safe=false: no explicit AC in the FEAT body (P2, no --deep/--spec passed, so PM does not draft AC this pass) -- AC-clarity gate trips regardless of numeric scores."
started_at: 2026-07-08
slices_complete: [SLICE-111]
completed_at: 2026-07-08
---
## Description

Full slice-ceremony e2e — drive the whole ceremony (slice start to build to review to validate to close) against the sample/temp repo and assert: artifacts land in .claude/artifacts/crew, workflow-state currentRun rotates, cost attribution attaches, and slice file moves to completed. Catches ceremony regressions that unit tests miss today.

## Acceptance criteria

- AC-1: Given a hermetic temp repo seeded with a triaged FEAT that has at least one `## Acceptance criteria` bullet, When `slice start --id FEAT-X` runs against it, Then a SLICE file is created under slices/pending, `workflow-state.json.currentRun` rotates to that slice, and a run-brief artifact is written under `.claude/artifacts/crew/runs/`.
- AC-2: Given a started slice with a review artifact (`decision: PASS`/approved) and a validation artifact (PASS) present, When `slice complete --id SLICE-X` runs, Then `reviewGate.satisfied` and `validationGate.satisfied` are both true, the slice file moves slices/pending → slices/completed, and the feature moves backlog/in-progress → backlog/done.
- AC-3: Given `slice complete` ran, When cost auto-emit fires, Then a cost-report artifact is written under `.claude/artifacts/crew/cost/` scoped to the rotated `currentRun` (attribution attaches to SLICE-X, not a stale window).
- AC-4: Given `slice grade --id SLICE-X` runs, When the grade file is created, Then its frontmatter back-links both `slice: SLICE-X` and the originating `feature:` (non-null) and the scores block is present.
- AC-5: Given the ceremony e2e harness, When it runs via the e2e-smoke entry (blocking-gate convention), Then it exits non-zero if any ceremony step fails to produce its expected artifact or state transition (start/complete/grade), consistent with existing e2e-smoke.ts asserts.

## Intake notes

Created via free-text intake (`/runner:intake "<text>"`). Priority is
unset — this FEAT has not been scored yet. Run `/runner:triage`
(PM scoring + `backlog pm-apply`) to score it before slicing.