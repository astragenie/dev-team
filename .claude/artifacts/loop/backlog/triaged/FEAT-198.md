---
id: FEAT-198
status: triaged
priority: P1
category: feature
target_release: null
created: 2026-07-08
updated: 2026-07-08
depends_on: []
slices: []
derived_from: null
pm_customer_impact: 0.7
pm_effort_estimate: 0.55
pm_strategic_alignment: 0.7
pm_technical_risk: 0.65
pm_dependency_depth: 0.45
pm_composite_priority: P1
pm_autonomous_safe: false
pm_reviewed: 2026-07-08
autonomous_safe: false
triage_notes: "technical_risk 0.65, band 0.6-0.8 (cross-module reach: touches .github/workflows/test.yml AND likely the cross-repo astragenie/common reusable workflow, matching FEAT-190's own risk table entry 'Cross-repo astragenie/common reusable CI doesn't accept Bun -- Med'). composite_score=0.6075 -> P1 via (impact>=0.7 AND alignment>=0.6); pre-mortem mandatory both via P1 and via risk>=0.6. autonomous_safe=false: technical_risk (0.65) exceeds the 0.6 numeric gate, and this touches the CI workflow definition itself (not just a script CI invokes), matching the repo's own precedent on FEAT-190 (CI-touching work marked autonomous_safe:false)."
---
## Description

Cross-platform OS matrix / golden gate — add a Linux plus Windows CI job (or a dedicated cross-platform golden test for homedir resolution and capture byte-parity) so the locally-green-not-equal-CI-green trap is caught in CI. Evidence: capture-parity Windows byte-filter, bun-homedir-ignores-home-on-linux, benchmark p95 skipped on Windows and CI. CI currently runs one self-hosted OS.

## Intake notes

Created via free-text intake (`/runner:intake "<text>"`). Priority is
unset — this FEAT has not been scored yet. Run `/runner:triage`
(PM scoring + `backlog pm-apply`) to score it before slicing.
## Acceptance criteria (Given-When-Then)

- AC-1: Given a new Linux CI job added to the test pipeline (in .github/workflows/test.yml or the coordinated astragenie/common reusable-plugin-ci.yml path), When `bun run test` runs on that job, Then it passes green using an env-first resolveHomeDir() resolution (not raw os.homedir()), closing the bun-homedir-ignores-home-on-linux gap.
- AC-2: Given a Windows CI job (existing self-hosted baseline, coordinated with FEAT-190 SLICE-C/E rather than duplicated) and the new Linux CI job running in parallel, When the capture-parity byte-filter test suite runs on both, Then both platforms produce byte-identical capture output, or any platform-specific delta is explicitly allowlisted with a documented reason -- closing the capture-parity Windows byte-filter flake.
- AC-3: Given the benchmark p95 suite currently skipped on Windows and in CI (edge/failure path), When the cross-platform matrix lands, Then the benchmark step either runs on at least one non-Windows CI job with a recorded p95 assertion, or is explicitly marked skip with a structured `benchmark_skip_reason` event logged rather than silently absent.
- AC-4: Given a PR that introduces a Linux-only or Windows-only regression, When CI runs the new matrix, Then the job for the affected OS fails (red) while the other OS job stays green, proving the matrix discriminates platform-specific breakage rather than duplicating identical assertions.
