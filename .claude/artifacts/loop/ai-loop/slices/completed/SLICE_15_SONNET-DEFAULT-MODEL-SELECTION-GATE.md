---
id: SLICE-15
feature: FEAT-031
title: Sonnet-default model-selection gate at slice start
status: completed
priority: P0
autonomous_safe: false
created: 2026-06-02
completed_at: 2026-06-02
updated: 2026-06-02
github_issue: 42
github_url: "https://github.com/sergeymilashico/hero-crew/issues/42"
---
# SLICE-15: Sonnet-default model-selection gate at slice start

- **Priority**: P0
- **Status**: Pending
- **Parent Feature**: FEAT-031
- **autonomous_safe**: false — lead prompt edit

## Objective

Codify cost-discipline rule #1 into `agents/lead.md`: at slice start,
recommend Sonnet for spec-framed mechanical work, recommend Opus only
for ambiguous architecture / hard refactor / design choices. Surface
the recommendation in the run-brief so the user can override before
the slice opens. Targets the 86.7% opus USD share visible in recent
cost reports.

## Why now

- Cost reports across 8 recent slices: `claude-opus-4-7` $1821 / 3 slices
  vs `claude-sonnet-4-6` $277 / 5 slices. Opus is paying 6.6x sonnet
  per dollar to do work that, by post-hoc inspection, was mechanical.
- Cost-discipline rule #1 from `feedback_cost_discipline.md` already
  states the rule; lead prompt doesn't enforce it.
- Last P0 in the perf backlog. Closes the perf-stabilization arc
  started in FEAT-029..034.
- Lead.md cap concern from FEAT-030 era is gone — v0.6.0 raised the
  cap to ≤300, lead is at 222, plenty of room.

## In scope

1. **`agents/lead.md`** — add new `### Model-selection gate at slice
   start (FEAT-031)` subsection inside `## Delegation thresholds (cost
   discipline)` (logical home — both are cost-discipline rules).
   Subsection MUST:
   - State the rule: Sonnet by default; Opus only when one of three
     conditions holds (ambiguous architecture, hard refactor, design
     choice required).
   - Define each condition concretely (with a one-sentence example).
   - Tell the lead to surface the recommendation in the run-brief
     artifact so the user can override before the slice opens.
   - Cross-reference cost-report `modelMix` as the
     recommendation-effectiveness signal (measured slice-over-slice
     by brief-me cost-health).
   - Keep ≤25 lines (target ~247-line lead.md final, well under 300).

2. **`docs/standards/model-selection.md`** (new) — short doc explaining
   the rule, the 5 dimensions of slice shape that determine
   mechanical-vs-ambiguous, and how to override. Linked from lead.md
   subsection. Target ≤80 lines.

3. **`docs/routing-table.md`** — add a new row mapping "slice opens"
   signal → "lead consults model-selection gate" route. One line.

4. **`CHANGELOG.md`** — v0.7.0 entry under FEAT-031.

## Out of scope

- Editing builder / reviewer / validator / deployer / researcher
  prompts. The model selection is a lead decision; teammates inherit
  per-dispatch.
- Adding automated model-switching logic in the CLI. This slice is
  prompt + doc only; the loop itself does not enforce model choice,
  only the recommendation.
- Re-running historical slices to validate the rule. Effectiveness
  is measured forward.
- v0.7.0 release tag — bumped + tagged in a separate `chore(release)`
  commit after slice closes.

## Acceptance criteria

- [ ] AC-1: `agents/lead.md` post-edit contains `### Model-selection
      gate at slice start` subsection with the three Opus-justified
      conditions named and the Sonnet-default rule stated explicitly.
- [ ] AC-2: Subsection cross-references `cost-report.modelMix` as
      the measurement signal.
- [ ] AC-3: Subsection instructs the lead to surface the
      recommendation in the run-brief artifact.
- [ ] AC-4: `docs/standards/model-selection.md` exists with the rule,
      the 5 slice-shape dimensions, and override instructions.
      ≤80 lines.
- [ ] AC-5: `docs/routing-table.md` has one new row for the
      slice-open → model-selection-gate signal.
- [ ] AC-6: `agents/lead.md` stays ≤300 lines after the addition.
      `node ./scripts/validate-agents.mjs` exits 0.
- [ ] AC-7: All 9 CI gates green.
- [ ] AC-8: `CHANGELOG.md` v0.7.0 FEAT-031 entry present.
- [ ] AC-9: User reviews lead.md prompt diff before commit per
      `autonomous_safe: false`.

## Done When

- all ACs PASS with evidence
- Self-Verify Gates in handoff (FEAT-030 rule)
- review-result written; FEAT-030 path applies (code-only doc
  edits + prompt addition, no user-visible runtime surface change
  beyond the recommendation behavior — bundled validation OK)
- final-synthesis + ceremony artifacts
- slice file pending → completed
- FEAT-031 in-progress → done

## Reviewer ladder

- Reviewer A (bundled per FEAT-030): code review — lead.md diff
  for additive-only discipline + ≤300 cap + cross-references
  valid + the three conditions named precisely. Emit
  `--validation-evidence` if conditions hold.

## Risks

- **Rule subjectivity** — "ambiguous architecture" and "hard refactor"
  are judgment calls. Mitigation: the doc spells out 5 concrete
  signals; the recommendation is overridable; cost-report modelMix
  reveals if the rule is being followed.
- **Lead is currently running on opus per the agent frontmatter** —
  the rule applies to model SELECTION for slice work, not the lead
  agent itself. Spell that distinction out so the reader doesn't
  conclude the lead should switch to sonnet for its own runs.
- **Recommendation surfacing** — run-brief schema may need a new
  field. Investigation first: check `scripts/lib/artifacts.mjs`
  run-brief renderer to see if a "Model" field is already there or
  needs adding. If adding fields to the writer is non-trivial,
  defer the structured field and have the lead simply state the
  recommendation in the run-brief `--next` or `--summary` text.

## Open questions

- Does the run-brief CLI already accept a `--model` / `--recommended-model`
  flag? Check `scripts/crew.mjs` write-run-brief block before deciding
  if AC-3 needs a CLI extension or is doc-only.
