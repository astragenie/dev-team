---
id: SLICE-110
title: Implement FEAT-196
status: completed
feature: FEAT-196
phase: null
priority: P1
target_release: null
requires_validation: true
risk: medium
created: 2026-07-08
updated: 2026-07-08
completed_at: 2026-07-08
---
# SLICE-110: Implement FEAT-196

Implements FEAT-196. See [feature file](../../../backlog/in-progress/FEAT-196.md) for product context.

## Objective

e2e recall-injection contract smoke — guard the frozen recall-injection-v1 contract at the e2e-smoke level: assert provider:none yields byte-identical dispatch and provider:file with one entry yields exactly one injected recall block (no double-inject). Protects the interface runner-plugin#368 consumes before that repo builds against it. Extends scripts/e2e-smoke.ts.

## In scope

- bullet 1
- bullet 2

## Out of scope

- bullet 1

## Acceptance criteria

- [ ] AC-1: Given provider:none configured for the recall-injection-v1 dispatch path, When scripts/e2e-smoke.ts runs the recall-injection contract check, Then the dispatch payload is byte-identical to the no-recall baseline (zero injected blocks).
- [ ] AC-2: Given provider:file configured with exactly one matching recall entry, When the e2e smoke exercises the dispatch path, Then exactly one recall block is injected into the dispatch payload (no duplicate or double-inject).
- [ ] AC-3: Given provider:file configured but the recall store returns zero matching entries (edge/failure path), When the e2e smoke exercises the dispatch path, Then the dispatch payload is byte-identical to the provider:none baseline and the run logs a structured `recall_injection_smoke` event with `entriesInjected: 0`.
- [ ] AC-4: Given the e2e smoke suite, When `bun run e2e:smoke` completes, Then a non-zero exit code is returned if any of AC-1/AC-2/AC-3 fail, consistent with the existing e2e-smoke.ts blocking-gate convention.

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-196 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
