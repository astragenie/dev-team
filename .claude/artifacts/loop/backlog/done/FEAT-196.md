---
id: FEAT-196
status: done
priority: P1
category: feature
target_release: null
created: 2026-07-08
updated: 2026-07-08
depends_on: []
slices: [SLICE-110]
derived_from: null
pm_customer_impact: 0.7
pm_effort_estimate: 0.2
pm_strategic_alignment: 0.7
pm_technical_risk: 0.15
pm_dependency_depth: 0.15
pm_composite_priority: P1
pm_autonomous_safe: true
pm_reviewed: 2026-07-08
autonomous_safe: true
triage_notes: "technical_risk 0.15 band 0.0-0.2 (known e2e-smoke.ts pattern, single file, trivial git revert). composite_score=0.7425 -> P1 via (impact>=0.7 AND alignment>=0.6). autonomous_safe=true: no numeric gate tripped (risk/effort/dep all <=0.6), only edits a script CI already invokes (not the workflow YAML itself), and ACs below cover the weak observability/test_confidence dimensions."
started_at: 2026-07-08
slices_complete: [SLICE-110]
completed_at: 2026-07-08
---
## Description

e2e recall-injection contract smoke — guard the frozen recall-injection-v1 contract at the e2e-smoke level: assert provider:none yields byte-identical dispatch and provider:file with one entry yields exactly one injected recall block (no double-inject). Protects the interface runner-plugin#368 consumes before that repo builds against it. Extends scripts/e2e-smoke.ts.

## Intake notes

Created via free-text intake (`/runner:intake "<text>"`). Priority is
unset — this FEAT has not been scored yet. Run `/runner:triage`
(PM scoring + `backlog pm-apply`) to score it before slicing.
## Acceptance criteria

- AC-1: Given provider:none configured for the recall-injection-v1 dispatch path, When scripts/e2e-smoke.ts runs the recall-injection contract check, Then the dispatch payload is byte-identical to the no-recall baseline (zero injected blocks).
- AC-2: Given provider:file configured with exactly one matching recall entry, When the e2e smoke exercises the dispatch path, Then exactly one recall block is injected into the dispatch payload (no duplicate or double-inject).
- AC-3: Given provider:file configured but the recall store returns zero matching entries (edge/failure path), When the e2e smoke exercises the dispatch path, Then the dispatch payload is byte-identical to the provider:none baseline and the run logs a structured `recall_injection_smoke` event with `entriesInjected: 0`.
- AC-4: Given the e2e smoke suite, When `bun run e2e:smoke` completes, Then a non-zero exit code is returned if any of AC-1/AC-2/AC-3 fail, consistent with the existing e2e-smoke.ts blocking-gate convention.
