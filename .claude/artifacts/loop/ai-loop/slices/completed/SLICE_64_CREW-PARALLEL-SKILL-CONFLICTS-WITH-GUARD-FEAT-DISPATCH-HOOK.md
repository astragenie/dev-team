---
id: SLICE-64
title: "/crew:parallel skill conflicts with guard-feat-dispatch hook"
status: completed
feature: FEAT-136
phase: null
priority: P2
target_release: null
requires_validation: true
created: 2026-06-10
updated: 2026-06-10
completed_at: 2026-06-10
---
# SLICE-64: /crew:parallel skill conflicts with guard-feat-dispatch hook

Implements FEAT-136. See [feature file](../../../backlog/in-progress/FEAT-136.md) for product context.

## Objective

`commands/parallel.md` step 7 tells the orchestrator to dispatch `agents/parallel-runner.md`, but consuming repos' `guard-feat-dispatch.mjs` PreToolUse hook blocks `crew:parallel-runner` on FEAT work (not in the ceremony-specialist allowlist). Apply **Path A** (FEAT-136 preferred): rewrite step 7 to dispatch `crew:lead` per worktree directly in one parallel Agent block, embedding the per-worktree slice ceremony in the skill body. WS2 pilot slice: full-tier ladder with concurrent reviewer+validator after builder PASS.

## In scope

- `commands/parallel.md` step 7 rewrite (Path A: per-worktree `crew:lead` dispatch, no parallel-runner)
- README + skill description updates reflecting Path A
- Documented decision on the fate of `agents/parallel-runner.md`
- Dry-run smoke evidence for the rewritten dispatch path

## Out of scope

- Hook allowlist changes (Path B / FEAT-137 territory)
- Changes to `loop dispatch prepare/finalize` CLI surfaces

## Acceptance criteria

- [ ] AC-1: `commands/parallel.md` step 7 dispatches `crew:lead` per worktree directly in one parallel Agent block (no `crew:parallel-runner` dispatch anywhere in the command flow); per-worktree slice ceremony embedded in the skill body
- [ ] AC-2: README and the `crew:parallel` skill description reflect the Path A flow; no doc still instructs dispatching parallel-runner on FEAT work
- [ ] AC-3: Dry-run smoke evidence: the rewritten command text contains no `subagent_type` value outside the guard-feat-dispatch allowlist (verified by grep against the allowlist quoted in FEAT-136), so the hook cannot block it
- [ ] AC-4: Fate of `agents/parallel-runner.md` decided and documented (keep for non-FEAT use with a scope note, or removed + EXPECTED_AGENTS/topology updated)
- [ ] AC-5: All tests pass (npm test) and linter is clean (npm run lint)

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-136 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: correctness/regression lens via concurrent `crew:reviewer` (WS2 pilot)
- Reviewer B: full gate via concurrent `crew:validator` (WS2 pilot)
