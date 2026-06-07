---
id: SLICE-18
status: pending
feature: FEAT-046
phase: null
priority: P2
target_release: null
requires_validation: true
created: 2026-06-07
updated: 2026-06-07
---
# SLICE-18: # FEAT-046 — Builder dispatch reliability

Implements FEAT-046. See [feature file](../../../backlog/in-progress/FEAT-046.md) for product context.

## Objective

SLICE-13: builder hit context ceiling at 50 tool uses / 91k tokens with no recovery

## In scope

- bullet 1
- bullet 2

## Out of scope

- bullet 1

## Acceptance criteria

- [ ] AC-1: `node scripts/crew.mjs scope-estimate --files <list>` returns `{ tier: "light"|"standard"|"heavy", reason: string }`
- [ ] AC-2: `agents/builder.md` contains `context_ceiling_reached` and `DONE_WITH_CONCERNS` in a `## Context ceiling` section; file stays ≤300 lines
- [ ] AC-3: `agents/lead.md` contains ceiling recovery rule referencing `scope-estimate`; file stays ≤300 lines
- [ ] AC-4: `brief-me` output includes `modelCompliance` field in the cost section
- [ ] AC-5: `scope-estimate` has ≥6 unit tests covering light/standard/heavy tier boundaries and eslint-disable escalation
- [ ] AC-6: `validate-agents.mjs` still passes (all agents ≤300 lines)

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-046 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
