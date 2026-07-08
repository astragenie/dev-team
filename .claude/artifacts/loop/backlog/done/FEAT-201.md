---
id: FEAT-201
status: done
closed: 2026-07-08
closure: "Landed on stabilization/e2e-wave (parallel wave). drift-check.ts CLI (exit 0/1/2, memory_drift event with count+ids) + new scheduled .github/workflows/drift.yml + hermetic scenarioDriftDualWrite e2e (fake-remote seam, no live daemon). Review approved (0 findings). Does not touch test.yml."
priority: P2
category: feature
target_release: null
created: 2026-07-08
updated: 2026-07-08
depends_on: []
slices: []
derived_from: null
pm_customer_impact: 0.65
pm_effort_estimate: 0.25
pm_strategic_alignment: 0.7
pm_technical_risk: 0.3
pm_dependency_depth: 0.3
pm_composite_priority: P2
pm_autonomous_safe: false
pm_reviewed: 2026-07-08
autonomous_safe: false
triage_notes: "technical_risk 0.30, band 0.3-0.5 (extends an existing, already-merged script (drift-check.ts) into a new CI/scheduled step -- new wiring pattern but no schema change, clean revert). composite_score=0.6925; neither P1 branch fires (impact 0.65 < 0.7; alignment 0.70 < 0.8) -> P2. autonomous_safe=false: no AC in the bare-prose FEAT body (P2, no --deep/--spec) trips the AC-clarity gate, and this wires into CI-or-scheduled-job config (CI-touching convention)."
---
## Description

Wire dual-write drift-check as a gate — run scripts/lib/memory/drift-check.ts in CI or a scheduled job with a drift threshold, and add an e2e asserting both stores land on dualWrite:true. astramem writes are fire-and-forget so the source-of-truth can silently fall behind the JSONL duplicate; this surfaces drift instead of hiding it.

## Acceptance criteria

_Files: `scripts/lib/memory/drift-check.ts`, `scripts/e2e-smoke.ts` (new scenario), NEW `.github/workflows/drift.yml`, `tests/drift-check*.test.ts`. Does NOT touch `test.yml`._

- AC-1: Given `scripts/lib/memory/drift-check.ts`, When run as a CLI (`--repo <path>` + a drift `--threshold`), Then it compares astramem (source-of-truth) against the local JSONL duplicate over a window and exits non-zero (and emits a structured `memory_drift` event) when entries-only-in-JSONL exceed the threshold, exit 0 otherwise.
- AC-2: Given a NEW scheduled workflow `.github/workflows/drift.yml` (cron + `workflow_dispatch`), When it runs, Then it invokes drift-check.ts and surfaces drift as a failing/annotated run. It is NOT wired into `.github/workflows/test.yml` — drift is a scheduled reconcile check, not a per-PR blocker (keeps this FEAT off the test.yml surface FEAT-200 owns).
- AC-3: Given `memory.provider: astramem` + `dualWrite: true`, When a capture fires in a new hermetic `scenarioDriftDualWrite` in `scripts/e2e-smoke.ts`, Then the entry lands in BOTH stores and drift-check reports zero drift; given an injected astramem-miss (entry only in JSONL), drift-check reports exactly that gap.
- AC-4: Given drift is detected, When drift-check runs, Then the emitted `memory_drift` event carries the count + ids of entries missing from the SoT so it can be reconciled/backfilled — surfacing silent divergence instead of hiding it (the S4 accepted-risk note made actionable).

## Intake notes

Created via free-text intake (`/runner:intake "<text>"`). Priority is
unset — this FEAT has not been scored yet. Run `/runner:triage`
(PM scoring + `backlog pm-apply`) to score it before slicing.