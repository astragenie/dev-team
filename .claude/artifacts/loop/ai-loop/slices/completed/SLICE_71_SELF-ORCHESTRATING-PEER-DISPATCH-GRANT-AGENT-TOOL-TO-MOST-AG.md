---
id: SLICE-71
title: "Self-orchestrating peer-dispatch — grant Agent tool to most agents, experiment, measure"
status: completed
feature: FEAT-163
phase: null
priority: P1
target_release: v0.36
requires_validation: true
created: 2026-06-13
updated: 2026-06-13
completed_at: 2026-06-13
---
# SLICE-71: Self-orchestrating peer-dispatch — grant Agent tool to most agents, experiment, measure

Implements FEAT-163. See [feature file](../../../backlog/in-progress/FEAT-163.md) for product context.

## Objective

Lead-as-sole-orchestrator pattern is **abandoned** (see [[project_lead_orchestration_abandoned]] memory). Two days of debugging the v0.35.2 / v0.35.3 lead-dispatch chain failed to reach a working state for autonomous flow. Loop's `slice-build` mode (lives in `src/scripts/lib/slice-linker/dispatch.mts`, default `orchestratorMode` as of FEAT-190) is the live orchestrator for the autonomous path.

SLICE-71 implements **FEAT-163 SLICE-A only** (foundation — 2 lowest-risk agents). SLICE-B/C/D/E deferred to follow-up slices. SLICE-C is hard-gated behind FEAT-161 Prong B landing.

## In scope

- Add `## Peer dispatch — when to use the Agent tool` section to `agents/document-writer.md` and `agents/refactor.md` (placed after `## Integration with Other Agents`)
- Section body per FEAT-163 spec includes: (a) peer whitelist with when-to-dispatch rationale; (b) blacklist enumeration; (c) dispatch budgets (≤2/slice, ≤1/turn); (d) Dispatch prompt purity subsection (inherited from lead v0.35.2: no identity injection, address peer directly, no caveman:*); (e) Final-tool-call invariant subsection (peer outputs ≠ substitute for own write-* artifact)
- Per FEAT-163 dispatch graph:
  - `document-writer` whitelist: `architect`, `researcher`, `investigator`; blacklist: implementers (`backend-dev`, `frontend-dev`, `fullstack-dev`), all gates (`inspector`, `inspector-verifier`, `verifier`, `release-engineer`)
  - `refactor` whitelist: `investigator` only; blacklist: implementers, all gates, peers
- Extend `scripts/validate-agents.ts` with lint rule: any agent whose frontmatter `tools:` includes `Agent` MUST contain a `## Peer dispatch` section with whitelist, blacklist, and budget lines. Failure raises non-zero exit. Apply rule to the 2 agents touched in this slice; other Agent-tool agents (lead, fullstack-dev, etc.) are out of scope and exempted via slice-scoped allowlist in the validator.

## Out of scope

- The other 8 agents in FEAT-163's Gain-Agent-tool table (`architect`, `backend-dev`, `frontend-dev`, `fullstack-dev`, `uxdesigner`, `qa-expert`, `performance-engineer`, `release-engineer`) — SLICE-B/C/D
- `scripts/validate-dispatch-graph.ts` (cycle detection across whitelist graph) — deferred to SLICE-B when ≥4 agents have whitelists worth graphing
- Constitution + dev.stable amendments — SLICE-D or close-out slice
- Removing `crew:lead` — separate cleanup FEAT
- Modifying loop's `slice-build` walker — out per FEAT-163 line 125

## Acceptance criteria

- [ ] AC-1: Both `agents/document-writer.md` and `agents/refactor.md` contain a `## Peer dispatch — when to use the Agent tool` section, placed after `## Integration with Other Agents` and before any subsequent tactical heading
- [ ] AC-2: Each new section contains: (a) explicit whitelist matching FEAT-163 spec; (b) explicit blacklist enumeration; (c) dispatch budget lines (`max 2 per slice`, `max 1 per turn`); (d) `### Dispatch prompt purity` subsection citing lead v0.35.2 purity rules; (e) `### Final-tool-call invariant (HARD)` subsection; (f) cite-back to FEAT-163
- [ ] AC-3: `scripts/validate-agents.ts` extended with a `Peer dispatch section` lint rule that hard-fails when an agent with `Agent` in `tools:` lacks the `## Peer dispatch` section structure (whitelist + blacklist + budget). Rule scoped via allowlist to `document-writer` and `refactor` for this slice; other Agent-tool agents exempted to avoid SLICE-B/C/D scope creep
- [ ] AC-4: Diff scope — `git diff --stat` shows modifications limited to: `agents/document-writer.md`, `agents/refactor.md`, `scripts/validate-agents.ts`, and (if needed) `scripts/validate-agents.test.ts` or equivalent test file. Zero edits to other agent prompts or unrelated scripts
- [ ] AC-5: Full CI green — `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test`, `node ./scripts/validate-agents.ts`, `node ./scripts/validate-manifests.ts`, `node ./scripts/validate-skills.ts`, `node ./scripts/validate-slices.ts` all exit 0
- [ ] AC-6: New unit test in `tests/` asserts `validate-agents.ts` Peer dispatch rule rejects an agent with `Agent` in tools but no `## Peer dispatch` section (negative case) AND accepts a correctly structured agent (positive case)

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-163 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
