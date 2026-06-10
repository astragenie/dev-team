---
id: SLICE-65
title: "Should crew:parallel-runner be a FEAT-ceremony specialist?"
status: completed
feature: FEAT-137
phase: null
priority: P3
target_release: null
requires_validation: true
created: 2026-06-10
updated: 2026-06-10
completed_at: 2026-06-10
---
# SLICE-65: Should crew:parallel-runner be a FEAT-ceremony specialist?

Implements FEAT-137. See [feature file](../../../backlog/in-progress/FEAT-137.md) for product context.

## Objective

Record the allowlist decision as an ADR. Context that fixes the outcome: FEAT-136 (SLICE-64, DEC-015) already shipped Path A — `/crew:parallel` dispatches `crew:lead` per worktree and `agents/parallel-runner.md` is scoped to non-FEAT work. This slice writes the ADR documenting **decision = NOT allowlist** (FEAT-137 AC-4 branch) with the explicit decision criteria evaluated. Docs-only deliverable — WS2 **light-tier pilot**: combined reviewer-validator gate instead of separate reviewer + validator.

## In scope

- New ADR at `docs/architecture/decisions/ADR-NNN-parallel-runner-allowlist.md` (next free NNN)
- Cross-links: ADR ↔ DEC-015, FEAT-136/FEAT-137

## Out of scope

- Any hook or allowlist code change (decision is NOT-allowlist; hook stays as-is)
- Changes to commands/parallel.md or agents/parallel-runner.md (shipped in SLICE-64)

## Acceptance criteria

- [ ] AC-1: ADR exists at `docs/architecture/decisions/ADR-NNN-parallel-runner-allowlist.md`, status accepted, recording decision = do NOT add crew:parallel-runner to the guard-feat-dispatch allowlist
- [ ] AC-2: ADR evaluates the three FEAT-137 decision criteria explicitly (dispatches-only-ceremony-specialists, own artifact trail, cannot-bypass-gates) and explains why the answer is still NOT-allowlist (Path A removed the need; smaller allowlist = tighter enforcement)
- [ ] AC-3: ADR cross-references DEC-015, FEAT-136 Path A, and notes parallel-runner's non-FEAT scope note; FEAT-137 AC-4 branch satisfied (hook unchanged, agent repurposed not retired)
- [ ] AC-4: Docs-only diff confirmed (git diff names only .md files); npm run lint and npm run format:check clean

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-137 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written

## Reviewer ladder

- Combined gate: `crew:reviewer-validator` (WS2 light-tier pilot — single dispatch runs full gate + lens review)
