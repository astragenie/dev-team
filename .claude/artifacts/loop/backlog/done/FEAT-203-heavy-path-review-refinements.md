---
id: FEAT-203
status: done
priority: P3
category: workflow
target_release: null
created: 2026-07-08
completed: 2026-07-08
depends_on: [FEAT-202]
slices: [SLICE-113]
derived_from: "review-cost optimization levers #4 + #5 (post-FEAT-202 residue)"
pm_customer_impact: 0.35
pm_effort_estimate: 0.2
pm_strategic_alignment: 0.5
pm_technical_risk: 0.25
pm_dependency_depth: 0.2
composite_score: 0.4
autonomous_safe: true
tags: [workflow, review-gate, cost, orchestrate-slice, fan-out-review, telemetry, config, prompt]
triage_notes: |
started_at: 2026-07-08
updated: 2026-07-08
slices_complete: [SLICE-113]
---
# FEAT-203: Heavy-path review refinements (stack-lens pick + parallel-dispatch telemetry)

## Context

FEAT-202 made the LOW/MEDIUM-risk common case a single reviewer with
validation delegated to the evidenced approval + CI. The two remaining
review-cost levers from the original analysis (#4 gate stack-reviewer
fan-out, #5 parallel-dispatch telemetry) only bite on the **risk-gated heavy
path** now (`RISK_GATE=true`: HIGH risk / `concern:security` /
`concern:performance` / `SPLIT_BUILD`), where a 2nd reviewer and/or a
dedicated `crew:verifier` fire in one parallel message. Two cheap
refinements make that path better:

1. **Stack-lens 2nd reviewer (#4).** `skills/workflow/fan-out-review/SKILL.md`
   currently says "2nd reviewer = the slice's dominant concern". When the
   diff is stack-heavy, the 2nd reviewer should be the stack specialist
   (`crew:csharp-reviewer` for a `.cs`-dominant diff, `crew:typescript-reviewer`
   for a `.ts`/`.tsx`-dominant diff) rather than a generic `crew:reviewer`
   second lens — same cost, better signal.

2. **Parallel-dispatch telemetry (#5).** The loop already ships
   `reviewer-timing.mts` (runner-plugin) which detects serial-vs-parallel
   reviewer execution against `config.reviewers.strictParallel` +
   `serialTimingThresholdMs`, consumed by the close/grade ceremony dev-team
   already runs. dev-team `.claude/loop.json` `reviewers` block sets neither,
   so the heavy path can silently serialize (3× wall-clock) with no signal.
   Activate it + document the single-message parallel-dispatch contract.

## Goal

On the risk-gated heavy path: the 2nd reviewer is stack-matched to the diff,
and serial dispatch of the parallel gate is detected and flagged.

## Non-goals

- Touching the LOW/MEDIUM default (FEAT-202 owns it — one reviewer, no
  verifier, no timing concern since nothing runs in parallel).
- Building a new telemetry engine — reuse the loop's `reviewer-timing`
  surface via config; do not port it into dev-team.
- Any runner-plugin edit.

## Acceptance criteria

- [ ] **AC-1**: Given `RISK_GATE=true` on a diff whose changed files are
  ≥60% `.cs` (resp. `.ts`/`.tsx`), When `fan-out-review` selects the 2nd
  reviewer, Then it picks `crew:csharp-reviewer` (resp.
  `crew:typescript-reviewer`); on a mixed/other diff it falls back to a
  generic `crew:reviewer` second lens. The selection rule is documented in
  `skills/workflow/fan-out-review/SKILL.md` and `commands/orchestrate-slice.md`.
- [ ] **AC-2**: Given dev-team `.claude/loop.json`, When the config lands,
  Then the `reviewers` block sets `strictParallel: true` and
  `serialTimingThresholdMs` (align with runner-plugin's 90000 default), and a
  test asserts the shape. (If the loop close/grade path is confirmed to read
  these for a dev-team slice, also assert the telemetry surfaces a
  serial-reviewer signal; otherwise document the prose-only boundary.)
- [ ] **AC-3**: Given `commands/orchestrate-slice.md` heavy-path step, When
  updated, Then it states the reviewers + verifier MUST be emitted in ONE
  parallel message (no message between dispatches, no wait-for-one-before-next)
  and that serial dispatch is flagged via the `reviewers.strictParallel`
  telemetry; `validate-skills.ts` + config validators pass.

## Slice plan

| Slice | Scope | Files | Gate | ETA |
|---|---|---|---|---|
| **SLICE-A** — heavy-path refinements | `fan-out-review` stack-lens selection rule; `.claude/loop.json` `reviewers.strictParallel` + `serialTimingThresholdMs`; `orchestrate-slice.md` heavy-path single-message contract + stack-lens note; config-shape + prose-contract tests | `skills/workflow/fan-out-review/SKILL.md`, `.claude/loop.json`, `commands/orchestrate-slice.md`, `tests/heavy-path-review-refinements.test.ts` | `bun test`; validate-skills; validate-configs | 0.5 d |

## Risks + mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Loop close/grade does not actually read `strictParallel` for a dev-team slice | Med | AC-2 downgrades to config-shape + prose-contract; verify by inspecting runner-plugin `reviewer-timing.mts` / `grade-telemetry.mts` consumption before claiming runtime behavior |
| Stack-lens % threshold (60%) misroutes a borderline diff | Low | Fallback to generic 2nd reviewer on non-dominant diffs; threshold documented + tested |
| Marginal value doesn't justify the change | Low | P3, single slice, autonomous_safe; skip if higher-priority work lands first |

## References

- Predecessor: FEAT-202 (lean review gate) — sets the RISK_GATE topology
  this FEAT refines.
- Telemetry surface: runner-plugin `src/scripts/lib/reviewer-timing.mts`
  (consumed by `grade-telemetry.mts` / `slice-linker/complete-slice.mts`),
  config keys `reviewers.strictParallel` + `serialTimingThresholdMs`.
- Original analysis: review-cost levers #4 + #5.
