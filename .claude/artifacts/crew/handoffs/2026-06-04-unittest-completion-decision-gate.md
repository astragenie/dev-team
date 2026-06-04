---
kind: handoff
created_at: 2026-06-04
scope: unittest-completion
status: awaiting-user-decision
gate: option-selection
related_commits:
  - 7c03173 (routing-table consistency validator)
  - d7e7b3b (drop terraform external-plugin rows)
---
# Handoff — unittest completion (decision gate)

## Objective

User asked "can we complete unittest now?" — ambiguous; 5 candidate gaps presented in chat. Decision required before dispatching builder.

## Current test surface (passing)

242 tests across:
- validate-skills, validate-agents, validate-routing-table, validate-slices (structural validators)
- cli, cost-*, briefing, fleet, installer, preflight-shell, regression, subagent-return
- crew-write-review-result

## Five candidate options

| # | Scope | Effort | Notes |
|---|---|---|---|
| 1 | Edge cases for new Pass 2 routing-table validator | 1–2h | Cover empty Skills-you-consult block, references/ suffix collapse, multi-role Route-to cell (`/` `+` `,`), missing agent file, malformed row |
| 2 | Behavior tests (real dispatch fixtures) | 10–15h | Option B from earlier brainstorm — agent X gets signal Y, verify cites skill Z. Heavy, flaky, costs real tokens |
| 3 | Polish slice for 28 advisory warnings | 2–3h | Add `triggers:` frontmatter + "When to use" + "Done / Acceptance" section headings to FEAT-A + Slice 1–5 skills missing them |
| 4 | Provenance audit — diff extracted skills vs upstream | 3–5h | Diff each `skills/<tier>/*/SKILL.md` against its `source:` agent. Catch content drift from builder's aggressive trims |
| 5 | Something else | — | User specifies |

## Lead lean

**Option 1** if user means literal unit-test coverage for the new validator code (highest value per hour; reuses existing fixture pattern).
**Option 3** if user means closing the 28-warning advisory backlog left by FEAT-A through Slice 5 (improves skill quality bar but is structural, not behavior tests).
**Option 4** if user is worried about content fidelity (separate concern — not unit tests per se, but worth doing if trim aggressiveness is a concern).

## What's next

1. User picks 1 / 2 / 3 / 4 / 5.
2. Lead writes spec or dispatches builder directly per pattern this session.
3. Per "do it" cadence: implement → commit → push.

## Current uncommitted state

- Working tree clean except pre-session `skills/agents-skils-comp.md` (typo'd filename, untouched all session).
- Local in sync with `origin/main` at `d7e7b3b`.
- All session commits pushed.

## References

- 28 advisory warnings: `node scripts/validate-skills.mjs` reports — missing `triggers:` + missing Trigger/Done section headings on skills extracted by FEAT-A.
- Routing-table validator: `scripts/validate-routing-table.mjs` (Pass 1 + Pass 2 logic, 298 lines).
- Test fixtures pattern: `tests/fixtures/validate-routing-table/`.
- Spec doc for Pass 2: `docs/superpowers/specs/2026-06-04-routing-agent-consistency-validator-design.md`.
