---
id: SLICE-72
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
# SLICE-72: Specialist-pause prevention — stub-artifact pattern + HARD OUTPUT CONTRACT in agent prompts

Implements FEAT-161. See [feature file](../../../backlog/in-progress/FEAT-161.md) for product context.

## Objective

Specialist dispatches (`crew:lead`, implementer roles, review roles, validation roles) regularly **pause mid-investigation and return without completing their mandatory `write-handoff` / `write-review-result` / `write-validation-result` step**. The parent receives narration ("I'll now check X", "Let me dispatch Y") with no tool call attached. The agentic loop's standard termination condition reads this as the final answer and returns. Parent has no artifact path, gate is unresolved, parent has to write a skip-badge or re-dispatch — costing ~150k tokens per recurrence.

SLICE-72 implements **FEAT-161 Prong B**: stub-artifact-on-entry pattern across 8 artifact-owning agent prompts. SLICE-70 (Prong A) landed the HARD OUTPUT CONTRACT block; Prong B layers the first-action stub pattern so mid-run pauses leave a detectable `decision: pending` artifact instead of nothing.

## In scope

- Add `## First action (stub artifact on entry)` section to 8 agents that own a `crew write-*` artifact contract:
  - `agents/fullstack-dev.md` (write-handoff)
  - `agents/frontend-dev.md` (write-handoff)
  - `agents/backend-dev.md` (write-handoff)
  - `agents/inspector.md` (write-review-result)
  - `agents/inspector-verifier.md` (write-review-result + write-validation-result, dual-stub)
  - `agents/verifier.md` (write-validation-result)
  - `agents/integrator.md` (write-handoff)
  - `agents/release-engineer.md` (write-deployment-check)
  - `agents/refactor.md` (write-handoff)
- Section body per FEAT-161 spec:
  - First action upon dispatch (before Read/Grep/Bash investigation): write stub via `crew write-* --scaffold --status in-progress --confidence low --summary "starting investigation"`
  - At end of run: re-call same command with real verdict + confidence (overwriting via `--update <path>`)
  - Cite-back to FEAT-161 + reference to DEC-019 (idempotency confirmed via tests/artifact-stub-and-update.test.ts scenarios 3-9)
- Extend `tests/agent-prompt-content.test.ts` with assertions across all 9 agents (8 single-stub + inspector-verifier dual-stub):
  - `## First action (stub artifact on entry)` heading present
  - References `--scaffold` or `--status in-progress` substring
  - References `--update` substring
  - Role-specific `crew write-*` command name
  - FEAT-161 cite-back

## Out of scope

- The 6 agents already targeted by SLICE-70 HARD OUTPUT CONTRACT block that DON'T own a write-* artifact — Prong B is write-* owner only
- Prong C: instrument `crew write-*` CLI with "promoted from stub" log line — deferred until observability trigger fires
- Adding `--update`/`--scaffold` CLI semantics — DEC-019 confirmed already shipped
- `agents/lead.md`, `agents/architect.md`, `agents/document-writer.md` — not artifact-owning roles in the FEAT-161 sense

## Acceptance criteria

- [ ] AC-1: All 9 target agents (8 + inspector-verifier dual) contain a `## First action (stub artifact on entry)` section placed after `## HARD OUTPUT CONTRACT (read first, every dispatch)` and before any tactical heading
- [ ] AC-2: Each section contains: (a) `--scaffold` or `--status in-progress` literal substring; (b) `--update` literal substring; (c) role-specific `crew write-handoff`/`write-review-result`/`write-validation-result`/`write-deployment-check` command name; (d) FEAT-161 cite-back; (e) DEC-019 reference
- [ ] AC-3: `tests/agent-prompt-content.test.ts` extended with `## First action — Prong B coverage` describe block asserting AC-1 + AC-2 across all 9 targeted agents
- [ ] AC-4: Diff scope — `git diff --stat` shows modifications limited to 9 agent prompts + `tests/agent-prompt-content.test.ts`. Zero edits to other agent files, scripts, or test files
- [ ] AC-5: Full CI green — `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test`, `node ./scripts/validate-agents.ts`, `node ./scripts/validate-manifests.ts`, `node ./scripts/validate-skills.ts`, `node ./scripts/validate-slices.ts` all exit 0
- [ ] AC-6: `inspector-verifier` section explicitly addresses dual-artifact (both review-result AND validation-result stub on entry)

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
