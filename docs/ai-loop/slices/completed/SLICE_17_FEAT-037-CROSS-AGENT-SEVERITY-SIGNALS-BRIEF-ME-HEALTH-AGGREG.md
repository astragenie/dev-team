---
id: SLICE-17
status: completed
feature: FEAT-037
phase: null
priority: P2
target_release: null
requires_validation: false
created: 2026-06-07
updated: 2026-06-07
completed_at: 2026-06-07
---
# SLICE-17: # FEAT-037 — Cross-agent severity signals + brief-me health aggregation

Implements FEAT-037. See [feature file](../../../backlog/in-progress/FEAT-037.md) for product context.

## Objective

Current crew agents emit unstructured prose in artifacts. Reviewer findings, builder risks,

## In scope

- bullet 1
- bullet 2

## Out of scope

- bullet 1

## Acceptance criteria

- [ ] AC-1: `write-review-result --findings` flag accepted and persisted in artifact frontmatter
- [ ] AC-2: `write-validation-result --findings` flag accepted and persisted
- [ ] AC-3: `write-deployment-check --findings` flag accepted and persisted
- [ ] AC-4: reviewer.md prompt emits structured `🔴:N,🟡:N,❓:N` in `--findings`
- [ ] AC-5: validator.md and deployer.md prompts emit role-adapted signals
- [ ] AC-6: brief-me JSON includes `runHealth` field when findings present
- [ ] AC-7: brief-me briefing renders run health summary (e.g. `2🔴 1🟡 across reviewer+validator`)
- [ ] AC-8: existing tests pass; new tests cover findings parsing and runHealth aggregation

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-037 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
