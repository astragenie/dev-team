# SLICE-{{NN}}: {{title}}

- **Priority**: {{P0|P1|P2}}
- **Status**: Pending
- **Author**: {{author}}
- **Created**: {{ISO-date}}

## Objective

One sentence describing the user-visible outcome of this slice.

## Why now

What unblocks this slice. What this slice unblocks for future slices.

## In scope

- bullet list of what the slice will produce
- be specific about files, services, modules, endpoints

## Out of scope

- bullet list of things explicitly NOT in this slice
- punt these to a future slice referenced by name

## Acceptance criteria

List each criterion the slice must meet. Each must be testable with evidence
per `01-loop-control/EVIDENCE_RULES.md`. Replace every `...` with concrete,
verifiable language before the slice opens — placeholder bullets fail the
slice-start linter.

- [ ] AC-1: <concrete, verifiable outcome>
- [ ] AC-2: <concrete, verifiable outcome>
- [ ] AC-N: tests cover all new public behavior (controllers, services,
      schema migrations, badges) — name the test file(s) and the scenarios
      they assert.

## Done When

The slice is complete only when:

- all acceptance criteria above are PASS with evidence
- build passes per `.claude/loop.json` `stack.build`
- tests pass per `.claude/loop.json` `stack.test`
- Crew `review-result` artifact written with `Test Adequacy` field populated
  (or explicit `Test Adequacy Skip Reason` / `Non-Code Review`)
- Crew `final-synthesis` artifact written
- entry appended to `../backlog/completed-slices.md`
- this slice file moved from `slices/pending/` → `slices/active/` →
  `slices/completed/` as it progresses

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...

## Risks

- ...

## Open questions

- ...
