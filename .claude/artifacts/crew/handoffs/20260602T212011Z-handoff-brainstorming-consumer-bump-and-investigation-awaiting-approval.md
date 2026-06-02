---
phase: post-v0.7.0
feature: null
slice: null
kind: handoff
status: brainstorming-awaiting-design-approval
mode: single-session
created: 2026-06-02T21:20:11Z
updated: 2026-06-02T21:20:11Z
---

# Task Handoff: superpowers:brainstorming mid-flight — design presented, awaiting user "OK"

## Objective

User invoked `/superpowers:brainstorming /plan 1,4` to plan two items
from the post-v0.7.0 stabilization next-step list:

- **Item 1** — Consumer crew bumps: push crew@0.7.0 + loop@0.5.6 to
  cortex, authentic, loopobserver, citylive, hcal.
- **Item 4** — Per-repo investigations: citylive tool-failure-rate
  (12/20 reports), authentic cost-regression (8/20 reports), hcal
  large-tool-output (8/20) + 32.7-reread-avg / 315-max.

## Owner

Lead (this session). User has reviewed 3 clarifying questions + chosen
1 approach. Awaiting "OK" or revisions on the 4-section design before
spec is written.

## Allowed scope

- Write `docs/operations/2026-06-02-consumer-crew-bump.md` (≤80 lines).
- Write `docs/investigations/2026-06-02-consumer-cost-hotspots.md` (~150 lines).
- Read-only triage of citylive / authentic / hcal cost reports + session
  logs. No edits in consumer repos.
- Final terminal action of brainstorming: invoke `superpowers:writing-plans`
  to author the implementation plan.

## Forbidden scope

- Running the bump commands (user-side action — only documented).
- Editing consumer repo code.
- Implementing fixes in hero-crew based on investigation findings (those
  become future slices, not this work).
- Investigating cortex (already healthiest cost profile) or extending
  loopobserver beyond the existing retro.

## Brainstorming progress

Questions asked + answered:

| # | Question | Answer |
|---|---|---|
| 1 | Bump shape: global vs per-repo pin vs hybrid | **Global user-level install** (Recommended). Single source of truth; no per-repo marketplace.json files added. |
| 2 | Investigation scope: triage-only vs trivial-fix vs new-FEATs | **Triage + findings doc only** (Recommended). Read-only across consumer repos. |
| 3 | Doc layout: one consolidated vs 3 per-repo vs append-to-retro | **One consolidated investigation doc** (Recommended). |
| 4 | Approach pick: A separate-docs vs B combined vs C investigation-only | **A — two separate docs** (Recommended). |

Design sections presented (all 4 awaiting user OK):

1. **Section 1 — Operations doc shape**: `docs/operations/2026-06-02-consumer-crew-bump.md`, ≤80 lines, with Pre-check / Bump commands / Verification per repo / Rollback / Audit-trail sections.
2. **Section 2 — Investigation doc shape**: `docs/investigations/2026-06-02-consumer-cost-hotspots.md`, ~150 lines, frontmatter + 3 repo sections (citylive/authentic/hcal) each with Symptom / Evidence / Investigation steps / Root-cause hypothesis / Recommended fix path / Follow-up FEAT candidate.
3. **Section 3 — Investigation methodology**: read-only, bounded — latest 5 cost reports per repo, 2-3 recent + 1 worst-case; cross-ref sourceProject + session-log dir; for citylive check non-zero report existence; for authentic diff usd-present vs usd-missing reports; for hcal check CREW_COST_HYGIENE env var presence.
4. **Section 4 — Done-when + out of scope**: 2 docs committed + pushed in hero-crew; each investigation section names at least one cost-report file as evidence + concrete next action. Bump-running, consumer code edits, and hero-crew fixes derived from findings are explicitly out of scope.

## Continuation plan for next session

If session resumes here:

1. Read this handoff end-to-end.
2. Confirm with user: do they OK all 4 design sections as presented above?
3. **If OK** — write spec to `docs/superpowers/specs/2026-06-02-consumer-bump-and-investigation-design.md`. Spec self-review (placeholder/contradiction/scope/ambiguity). Ask user to review the written spec.
4. **After spec approved** — invoke `superpowers:writing-plans` to author the implementation plan. That's the brainstorming skill's terminal state.
5. **If user requests changes** — revise the affected design section, re-present, repeat.

## Changed files or evidence

- No files written this session-segment (brainstorming is design-only until spec is written).
- Source context already captured in prior session artifacts:
  - `.claude/artifacts/loop/retrospectives/2026-06-02-cross-repo.md`
  - `.claude/artifacts/loop/retrospectives/2026-06-02-cross-repo-cost-efficiency.md`
  - `.claude/artifacts/crew/runs/20260602T160653Z-final-synthesis-cross-repo-retrospective-cost-efficiency-cost-advise-analysi.md`

## Confidence level

High on the design as presented — small read-only investigation + 2
clean docs. Low risk of scope drift since explicit out-of-scope items
are enumerated.

## Risks or open questions

- User may revise sections 2-3 (investigation methodology depth) before
  spec is written. That's expected — brainstorming is iterative.
- Per-repo investigation for citylive may reveal a deeper issue than
  triage-only resolves; spec explicitly says findings → future slices,
  not in-scope fixes. Discipline.
- Two repos (cortex + authentic) have pre-existing uncommitted changes
  from other sessions. Investigation is read-only there, so no conflict.
- hcal is at `/c/work/mega/hero-crew-autonomous-loop` — separate repo
  with separate marketplace.json + loop plugin SOURCE. The "bump" item
  applies to it as a CONSUMER of crew@0.7.0, but as a source of loop@0.5.6
  it's already current. Confirm during spec write.

## Suggested next handoff

After spec is written + user-reviewed: a handoff named
`<ts>-handoff-design-approved-ready-for-writing-plans.md` capturing the
spec path + the trigger to invoke writing-plans.

If user pivots away from this work entirely: a handoff noting the pivot
+ pointing to this brainstorming as deferred.
