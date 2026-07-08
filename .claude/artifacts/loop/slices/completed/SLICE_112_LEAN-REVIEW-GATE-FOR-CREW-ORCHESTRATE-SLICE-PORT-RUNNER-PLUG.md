---
id: SLICE-112
title: "Lean review gate for /crew:orchestrate-slice (port runner-plugin model)"
status: completed
feature: FEAT-202
phase: null
priority: P2
target_release: null
requires_validation: true
risk: medium
created: 2026-07-08
updated: 2026-07-08
touches_files: [.claude/loop.json, commands/orchestrate-slice.md, skills/workflow/validator-gate/SKILL.md, skills/workflow/fan-out-review/SKILL.md, tests/validation-gate-delegation.test.ts]
completed_at: 2026-07-08
---
# SLICE-112: Lean review gate for /crew:orchestrate-slice (port runner-plugin model)

Implements FEAT-202. See [feature file](../../../backlog/in-progress/FEAT-202.md) for product context.

## Objective

Port runner-plugin's proven lean post-builder gate into dev-team's
`/crew:orchestrate-slice` path. Today every slice dispatches 2 reviewers
(`ladder ["A","B"]` + fan-out) plus a mandatory always-on `crew:verifier` that
re-runs the whole-repo full suite — redundant with the pre-push hook + CI test
gate. Make the LOW/MEDIUM-risk common case dispatch a single reviewer with
validation delegated to the evidenced reviewer approval + CI full suite
(`loop.validation.satisfiedByReview: true`, already honored by
`deriveValidationGate`). Keep the heavy path (HIGH risk / `concern:security` /
`concern:performance` / `SPLIT_BUILD`) available but risk-gated, not defaulted.

## In scope

- `.claude/loop.json` — `reviewers.ladder` `["A","B"]` → `["A"]`; add
  `loop.validation.satisfiedByReview: true`.
- `commands/orchestrate-slice.md` — Step 4.5/4/5: single-reviewer default;
  dedicated `crew:verifier` and 2nd reviewer only on the risk gate.
- `skills/workflow/validator-gate/SKILL.md` — add the `satisfiedByReview`
  delegation path (LOW/MEDIUM default) + risk-gated exceptions to the current
  "always dispatch, no skip" prose.
- `skills/workflow/fan-out-review/SKILL.md` — reaffirm 1-reviewer default; 2–4
  reviewers on HIGH risk / security+perf only.
- `tests/validation-gate-delegation.test.ts` — assert the review-badge
  delegation resolves `satisfied: true` on an evidenced approval AND does NOT
  satisfy on the `unproven` fallthrough.

## Out of scope

- Any runner-plugin edit — it is the source pattern, already lean;
  `deriveValidationGate` already honors `satisfiedByReview` (no gate-code
  change needed).
- Model-tier routing for review/verify — dev-team `modelRouting` already routes
  them to `default: sonnet`; separate lever.
- Removing the full test suite anywhere — it MUST still run at pre-push + CI;
  this slice only drops the per-slice dedicated verifier agent.

## Acceptance criteria

- [ ] **AC-1**: Given dev-team `.claude/loop.json`, When the config lands, Then
  `reviewers.ladder` is `["A"]` AND a `loop.validation` block sets
  `satisfiedByReview: true`, and the config-schema / consumer tests stay green.
- [ ] **AC-2**: Given a LOW/MEDIUM-risk code-bearing slice run through
  `/crew:orchestrate-slice`, When the post-builder gate dispatches, Then the
  command prose directs exactly **one** `crew:reviewer` and **no** dedicated
  `crew:verifier`; the reviewer writes an evidenced review-result artifact.
- [ ] **AC-3**: Given a HIGH-risk slice OR one tagged `concern:security` /
  `concern:performance` OR `SPLIT_BUILD = true`, When the gate dispatches, Then
  the heavy path still fires (2nd reviewer per `fan-out-review` and/or a
  dedicated `crew:verifier`); the override condition is documented in the
  command + skill.
- [ ] **AC-4**: Given a slice closed via `/runner:close` with
  `satisfiedByReview: true` and an evidenced reviewer approval but no separate
  validation artifact, When the close gate resolves, Then `deriveValidationGate`
  returns `satisfied: true` with the `review-badge:` reason (NOT the unproven
  fallthrough), AND the pre-push hook + `.github/workflows/test.yml` still run
  the whole-repo full suite so test validation is never silently dropped.
- [ ] **AC-5**: Given `skills/workflow/validator-gate/SKILL.md` (currently
  "always dispatch, no skip"), When updated, Then it documents the
  `satisfiedByReview` delegation path as the LOW/MEDIUM default and the
  risk-gated exceptions, and `validate-skills.ts` passes.

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-202 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written

## Reviewer ladder

- Reviewer A: correctness — does the config + prose actually produce a
  single-reviewer LOW/MEDIUM path and preserve the risk-gated heavy path;
  is the `deriveValidationGate` delegation test asserting the `!unproven`
  guard.
- Reviewer B: production-readiness — is the full suite still owned by
  pre-push + CI (AC-4), no silent drop of test validation; skill/command
  prose consistent, no contradictory "always dispatch" remnant.
