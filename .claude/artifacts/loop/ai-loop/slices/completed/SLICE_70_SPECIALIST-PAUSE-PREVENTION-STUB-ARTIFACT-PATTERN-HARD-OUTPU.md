---
id: SLICE-70
title: Specialist-pause prevention — stub-artifact pattern + HARD OUTPUT CONTRACT in agent prompts
status: completed
feature: FEAT-161
phase: null
priority: P1
target_release: null
requires_validation: true
created: 2026-06-13
updated: 2026-06-13
completed_at: 2026-06-13
---
# SLICE-70: Specialist-pause prevention — stub-artifact pattern + HARD OUTPUT CONTRACT in agent prompts

Implements FEAT-161. See [feature file](../../../backlog/in-progress/FEAT-161.md) for product context.

## Objective

Specialist dispatches (`crew:lead`, implementer roles, review roles, validation roles) regularly **pause mid-investigation and return without completing their mandatory `write-handoff` / `write-review-result` / `write-validation-result` step**. The parent receives narration ("I'll now check X", "Let me dispatch Y") with no tool call attached. The agentic loop's standard termination condition reads this as the final answer and returns. Parent has no artifact path, gate is unresolved, parent has to write a skip-badge or re-dispatch — costing ~150k tokens per recurrence.

SLICE-70 implements **Prong A only** (FEAT-161 SLICE-A). Prong B + C deferred to follow-up slices.

## In scope

- Add `## HARD OUTPUT CONTRACT (read first, every dispatch)` block to 6 agent prompts: `architect.md`, `inspector-verifier.md`, `integrator.md`, `release-engineer.md`, `document-writer.md`, `refactor.md`
- Block placement: after frontmatter + identity anchor (where present), before any tactical heading
- Block contents per role: header, preamble, role-specific valid-last-tool-call list, cite-back to FEAT-161
- Extend `tests/agent-prompt-content.test.ts` with `## HARD OUTPUT CONTRACT — Prong A coverage` block asserting presence, position, required phrases, role-specific substrings, and FEAT cite-back across all 12 targeted agents

## Out of scope

- The 6 already-compliant agents (`lead`, `fullstack-dev`, `frontend-dev`, `backend-dev`, `inspector`, `verifier`) — text MUST NOT be reworded or moved (AC-3 enforces this)
- Prong B (stub-artifact pattern) — separate SLICE-B
- Prong C (CLI promoted-from-stub log) — deferred
- Excluded agents (no dispatch surface): `investigator`, `researcher`, `qa-expert`, `performance-engineer`, `uxdesigner`, `parallel-runner`

## Acceptance criteria

- [ ] AC-1: `tests/agent-prompt-content.test.ts` extended with `## HARD OUTPUT CONTRACT — Prong A coverage` block asserting all 12 targeted agents contain `## HARD OUTPUT CONTRACT (read first, every dispatch)` heading + required preamble phrase + role-specific valid-last-tool-call substring
- [ ] AC-2: HARD CONTRACT block placement — for agents with identity anchor, `idx(HARD_CONTRACT) > idx(Identity anchor) AND idx(HARD_CONTRACT) < idx(first tactical heading)`; for agents without, block appears after frontmatter close + `## Custom instructions` (if present) but before any tactical heading
- [ ] AC-3: Diff scope — `git diff --stat` shows modifications limited to 6 added agents (`architect`, `inspector-verifier`, `integrator`, `release-engineer`, `document-writer`, `refactor`) + `tests/agent-prompt-content.test.ts`; zero edits to the 6 already-compliant agent files
- [ ] AC-4: Each newly added HARD CONTRACT block contains a cite-back to FEAT-161 (either `FEAT-161` literal string or path to `.claude/artifacts/loop/backlog/in-progress/FEAT-161.md`)
- [ ] AC-5: Full CI green — `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test`, `node ./scripts/validate-agents.ts`, `node ./scripts/validate-manifests.ts`, `node ./scripts/validate-skills.ts`, `node ./scripts/validate-slices.ts` all exit 0

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-161 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
