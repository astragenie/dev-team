---
id: SLICE-113
title: Heavy-path review refinements (stack-lens pick + parallel-dispatch telemetry)
status: completed
feature: FEAT-203
phase: null
priority: P3
target_release: null
requires_validation: true
risk: low
created: 2026-07-08
updated: 2026-07-08
touches_files: [skills/workflow/fan-out-review/SKILL.md, .claude/loop.json, commands/orchestrate-slice.md, tests/heavy-path-review-refinements.test.ts]
completed_at: 2026-07-08
---
# SLICE-113: Heavy-path review refinements (stack-lens pick + parallel-dispatch telemetry)

Implements FEAT-203. See [feature file](../../../backlog/in-progress/FEAT-203.md) for product context.

## Objective

FEAT-202 made the LOW/MEDIUM-risk common case a single reviewer. This slice
improves the remaining risk-gated **heavy path** (`RISK_GATE=true`): (#4) the
2nd reviewer is chosen as the stack specialist by diff extension, and (#5) the
loop's already-built reviewer-timing telemetry is activated + the single-message
parallel-dispatch contract documented so silent serialization is flagged.

## In scope

- `skills/workflow/fan-out-review/SKILL.md` — 2nd-reviewer selection rule: a
  `.cs`-dominant diff → `crew:csharp-reviewer`; `.ts`/`.tsx`-dominant →
  `crew:typescript-reviewer`; otherwise generic `crew:reviewer` 2nd lens.
- `.claude/loop.json` — `reviewers.strictParallel: true` +
  `serialTimingThresholdMs` (align runner-plugin default 90000).
- `commands/orchestrate-slice.md` — heavy-path step: single-message parallel
  dispatch contract + stack-lens note.
- `tests/heavy-path-review-refinements.test.ts` — config-shape + prose-contract
  assertions.

## Out of scope

- The LOW/MEDIUM default path (owned by FEAT-202 — one reviewer, no verifier,
  no timing concern).
- Building a new telemetry engine — reuse the loop's `reviewer-timing` surface
  via config only.
- Any runner-plugin edit.

## Acceptance criteria

- [ ] **AC-1**: Given `RISK_GATE=true` on a diff whose changed files are ≥60%
  `.cs` (resp. `.ts`/`.tsx`), When `fan-out-review` selects the 2nd reviewer,
  Then it picks `crew:csharp-reviewer` (resp. `crew:typescript-reviewer`); a
  mixed/other diff falls back to a generic `crew:reviewer` 2nd lens. Rule
  documented in `fan-out-review/SKILL.md` + `orchestrate-slice.md`.
- [ ] **AC-2**: Given dev-team `.claude/loop.json`, When the config lands, Then
  the `reviewers` block sets `strictParallel: true` and `serialTimingThresholdMs`
  (90000), and a test asserts the shape. FIRST verify whether runner-plugin's
  `reviewer-timing.mts` / `grade-telemetry.mts` actually consume these for a
  dev-team close; if yes, also assert the serial-reviewer signal surfaces; if
  not, document the prose-only boundary in the handoff (do NOT fabricate a
  cross-plugin import).
- [ ] **AC-3**: Given `commands/orchestrate-slice.md` heavy-path step, When
  updated, Then it states reviewers + verifier MUST be emitted in ONE parallel
  message (no interleaved message, no wait-for-one-before-next) and that serial
  dispatch is flagged via `reviewers.strictParallel` telemetry; `validate-skills.ts`
  + config validators pass.

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-203 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written

## Reviewer ladder

- Reviewer A: correctness — stack-lens selection rule matches the ≥60%
  threshold + fallback; config shape valid; prose contracts consistent.
