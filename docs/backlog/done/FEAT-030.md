---
id: FEAT-030
title: Builder self-verify + reviewer-bundled validation
priority: P0
status: done
category: performance
target_release: v0.5.0
created: 2026-06-01
updated: 2026-06-02
depends_on: []
slices: [SLICE-11]
derived_from: null
autonomous_safe: false
---

## Description

Recent slices dispatch 49+ subagents per slice (SLICE-08 cost report).
Each cold-start re-loads context without cache reuse. Cost-discipline
rule #3 from `feedback_cost_discipline.md` already states: builder
self-verifies, then ONE reviewer pass that also writes the
validation-result artifact for tests-already-green code-only changes.
Codify that rule into the agent prompts so the loop stops triple-
dispatching builder + reviewer + validator on routine work.

## Acceptance hints

- `agents/builder.md` requires the builder to run lint + tests +
  typecheck before completing, and to report the result in the handoff.
- `agents/reviewer.md` requires the reviewer to emit a
  validation-evidence note when the change is tests-already-green +
  code-only + no runtime / UI / CLI surface affected.
- Lead workflow skips dispatching `crew:validator` when the reviewer
  has emitted that note. Validator still dispatches when behavior is
  user-visible (UI, CLI surface, runtime side-effects).
- Reviewer handoff continues to include `Test Adequacy` populated
  (FEAT-023 compatibility).
- e2e-smoke or representative slice confirms the new path drops
  subagent dispatches per slice meaningfully.

## Notes

- `autonomous_safe: false` — agent prompt edits require human review
  on the slice handoff (`FEAT-003` precedent).
- Pairs with FEAT-032 (artifact-path-only returns) for combined
  compaction + subagent wins.
- Source analysis: handoff `20260601T115349Z-...-awaiting-user-choice.md`.
