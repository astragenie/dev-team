---
id: SLICE-08
status: pending
feature: FEAT-004
phase: null
priority: P3
target_release: null
created: 2026-05-28
updated: 2026-05-28
---
# SLICE-08: Enable noImplicitAny and annotate scripts/**/*.mjs

Implements FEAT-004. See [feature file](../../../backlog/in-progress/FEAT-004.md) for product context.

## Objective

LSP flags implicit-any as errors; tsc silently accepts (noImplicitAny: false). Enabling aligns LSP and tsc. Scope: tsconfig.json flag + JSDoc @param/@returns on functions with implicit any in scripts/**/*.mjs. AC: tsc --noEmit passes with noImplicitAny:true, lint clean, zero LSP implicit-any warnings.

## In scope

- bullet 1
- bullet 2

## Out of scope

- bullet 1

## Acceptance criteria

- [ ] AC-1: ...
- [ ] AC-2: ...

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-004 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
