---
id: FEAT-202
status: done
priority: P2
category: workflow
target_release: null
created: 2026-07-08
completed: 2026-07-08
depends_on: []
slices: [SLICE-112]
derived_from: runner-plugin review-gate model (post-builder-fanout + deriveValidationGate)
pm_customer_impact: 0.55
pm_effort_estimate: 0.25
pm_strategic_alignment: 0.65
pm_technical_risk: 0.35
pm_dependency_depth: 0.2
composite_score: 0.54
autonomous_safe: false
tags: [workflow, review-gate, cost, orchestrate-slice, cross-repo, config, prompt]
triage_notes: |
started_at: 2026-07-08
updated: 2026-07-08
slices_complete: [SLICE-112]
---
# FEAT-202: Lean review gate for /crew:orchestrate-slice (port runner-plugin model)

## Context

dev-team's `/crew:orchestrate-slice` currently runs a heavy post-builder gate
on **every** slice:

- **2 reviewers** — `.claude/loop.json` `reviewers.ladder: ["A", "B"]`, plus the
  `fan-out-review` skill scaling to 2–4 on HIGH-risk / `concern:security` /
  `concern:performance`, plus stack reviewers (`crew:typescript-reviewer` /
  `crew:csharp-reviewer`) fanned alongside the base reviewer.
- **1 mandatory verifier** — `commands/orchestrate-slice.md` Step 5 +
  `skills/workflow/validator-gate/SKILL.md` say `crew:verifier` is always
  dispatched with **no skip path**, and it re-runs the whole-repo full gate
  (lint, `format:check`, complete test suite, `verify:all`).

They dispatch in parallel, so wall-clock ≈ slowest agent — the real cost is
**tokens** (3 agents each re-load diff + handoff + slice + contract context)
and **redundant full-suite runs** (the verifier repeats what the pre-push hook
and CI test gate already run on push — the token-burn plan
`docs/research/2026-07-06-token-burn-patch-plan.md` found full-suite runs are
the #1 dispatch cut-off trigger).

runner-plugin already solved this exact problem and runs it in production:

- `reviewers.ladder: ["A"]` — a single reviewer (see runner-plugin
  `src/scripts/lib/post-builder-fanout.mts` + CLAUDE.md "Reviewer ladder
  presets").
- **No post-builder validator** — `loop.validation.satisfiedByReview: true`;
  an *evidenced* reviewer approval badge closes the close-time validation gate,
  and the full suite is delegated to the CI test gate (CLAUDE.md "No
  post-builder validator"; `deriveValidationGate` in
  `src/scripts/lib/validation-gate.mts`).

Crucially, `deriveValidationGate` **already** honors
`loop.validation.satisfiedByReview` (requires `reviewGate.satisfied &&
!reviewGate.unproven` — a real artifact/badge, never the tolerant
absence-fallthrough). Both repos use the loop plugin's `/runner:close`
ceremony, so the gate resolution is shared. **No gate-code change is needed** —
only dev-team config + the crew orchestrate-slice command prose + the
validator-gate skill.

## Goal

Common-case dev-team slice: **1 reviewer, no dedicated verifier**, validation
delegated to the evidenced reviewer approval + the CI/pre-push full-suite gate.
Heavy path stays available but **risk-gated**, not defaulted.

## Non-goals

- Changing runner-plugin (it is the source pattern, already lean — no edit).
- Model-tier routing for review/verify (dev-team `modelRouting` already routes
  review/verify to `default: sonnet`; that lever is already pulled — separate
  from this FEAT).
- Removing the full suite anywhere — it MUST still run at pre-push + CI. This
  FEAT only removes the *per-slice dedicated verifier agent*, not the suite.
- Gutting `fan-out-review` — its 2–4 reviewer scaling stays for genuinely
  HIGH-risk slices; only the *default* count drops to 1.

## Acceptance criteria

- **AC-1**: Given dev-team `.claude/loop.json`, When the config lands, Then
  `reviewers.ladder` is `["A"]` AND a `loop.validation` block sets
  `satisfiedByReview: true`, and `bun test` (config-schema/consumer tests) stays
  green.
- **AC-2**: Given a LOW/MEDIUM-risk code-bearing slice run through
  `/crew:orchestrate-slice`, When the post-builder gate dispatches, Then exactly
  **one** `crew:reviewer` is dispatched and **no** dedicated `crew:verifier` is
  dispatched; the reviewer writes an evidenced review-result artifact.
- **AC-3**: Given a HIGH-risk slice OR one tagged `concern:security` /
  `concern:performance` OR `SPLIT_BUILD = true`, When the gate dispatches, Then
  the heavy path still fires (2nd reviewer per `fan-out-review` and/or a dedicated
  `crew:verifier`) — the lean default is overridden by the risk signal, and the
  override condition is documented in the command + skill.
- **AC-4**: Given a slice closed via `/runner:close` with `satisfiedByReview: true`
  and an evidenced reviewer approval but no separate validation artifact, When the
  close gate resolves, Then `deriveValidationGate` returns `satisfied: true` with
  the `review-badge:` reason (NOT the unproven fallthrough), AND the pre-push hook
  + `.github/workflows/test.yml` still run the whole-repo full suite so test
  validation is never silently dropped.
- **AC-5**: Given `skills/workflow/validator-gate/SKILL.md` (currently "always
  dispatch, no skip"), When updated, Then it documents the `satisfiedByReview`
  delegation path as the LOW/MEDIUM default and the risk-gated exceptions, and the
  agent/skill validators (`validate-skills.ts`) pass.

## Slice plan

| Slice | Scope | Files | Gate | ETA |
|---|---|---|---|---|
| **SLICE-A** — Config + gate delegation | `.claude/loop.json`: `reviewers.ladder` → `["A"]`; add `loop.validation.satisfiedByReview: true`. Confirm `deriveValidationGate` review-badge path resolves for a dev-team slice (no code change expected; add/adjust a test asserting the delegation). | `.claude/loop.json`, `tests/*validation*` | `bun test`; snapshot-freshness | 0.5 d |
| **SLICE-B** — Command + skill prose | `commands/orchestrate-slice.md` Step 4.5/4/5: single reviewer default, dedicated verifier only on risk-gate; `skills/workflow/validator-gate/SKILL.md`: add satisfiedByReview delegation + risk exceptions; `skills/workflow/fan-out-review/SKILL.md`: reaffirm 1-reviewer default, 2–4 on risk. | `commands/orchestrate-slice.md`, `skills/workflow/validator-gate/SKILL.md`, `skills/workflow/fan-out-review/SKILL.md` | validate-skills; content-length caps | 0.5 d |

**Dependency order:** A → B. A proves the gate delegates before B rewrites the
dispatch prose to rely on it.

## Risks + mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Dropping the per-slice verifier silently drops full-suite validation if CI/pre-push don't actually run it | High | AC-4 makes CI + pre-push full-suite ownership an explicit gate; verify `test.yml` + pre-push hook run the full suite before landing |
| `satisfiedByReview` closes on an *unproven* reviewer fallthrough (no real artifact) | Med | `deriveValidationGate` already requires `!reviewGate.unproven`; SLICE-A adds a test asserting the unproven path does NOT satisfy |
| Heavy-risk slice loses its 2nd reviewer / verifier by mistake | Med | AC-3 keeps the risk-gated heavy path; explicit override condition documented in command + skill |
| dev-team `reviewers.ladder` is only read by runner-plugin's post-builder-fanout, not the crew orchestrate-slice path (vestigial) | Low | SLICE-B changes the orchestrate-slice *prose* (the actual dispatch surface) too, not just the config; config change is belt-and-suspenders for any post-builder-fanout consumer |

## References

- Source pattern (already lean, no edit): runner-plugin
  `src/scripts/lib/post-builder-fanout.mts`,
  `src/scripts/lib/validation-gate.mts` (`deriveValidationGate` +
  `satisfiedByReview`), CLAUDE.md "Reviewer ladder presets" / "No post-builder
  validator".
- dev-team surfaces to change: `.claude/loop.json` (`reviewers`, `loop`),
  `commands/orchestrate-slice.md` (Step 4.5/4/5),
  `skills/workflow/validator-gate/SKILL.md`,
  `skills/workflow/fan-out-review/SKILL.md`.
- Cost rationale: `docs/research/2026-07-06-token-burn-patch-plan.md`
  (full-suite runs = #1 cut-off trigger; redundant per-slice verifier).
