---
id: SLICE-73
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
# SLICE-73: Self-orchestrating peer-dispatch — grant Agent tool to most agents, experiment, measure

Implements FEAT-163. See [feature file](../../../backlog/in-progress/FEAT-163.md) for product context.

## Objective

Lead-as-sole-orchestrator pattern is **abandoned** (see [[project_lead_orchestration_abandoned]] memory). Two days of debugging the v0.35.2 / v0.35.3 lead-dispatch chain failed to reach a working state for autonomous flow. Loop's `slice-build` mode (lives in `src/scripts/lib/slice-linker/dispatch.mts`, default `orchestratorMode` as of FEAT-190) is the live orchestrator for the autonomous path.

SLICE-73 implements **FEAT-163 SLICE-B**: advisory tier (4 more agents) + dispatch-graph cycle detection + regex tightening from SLICE-71 MEDIUM finding.

## In scope

- Add `## Peer dispatch — when to use the Agent tool` section to 4 advisory agents (mirror SLICE-71 structure):
  - `agents/architect.md` — whitelist: `researcher`, `investigator`, `document-writer`
  - `agents/uxdesigner.md` — whitelist: `architect`, `researcher`
  - `agents/qa-expert.md` — whitelist: `investigator`, `performance-engineer`
  - `agents/performance-engineer.md` — whitelist: `investigator`, `qa-expert`
- Each section: whitelist + full blacklist enumeration + budgets (max 2/slice, max 1/turn) + Dispatch prompt purity subsection + Final-tool-call invariant subsection + FEAT-163 cite-back
- Extend `scripts/validate-agents.ts` `PEER_DISPATCH_ALLOWLIST` to include the 4 new agents (total 6 entries)
- **Tighten `hasWhitelistEntry` regex** per SLICE-71 inspector MEDIUM: split `afterPeerDispatch` at `MUST NOT dispatch` boundary; test only the prefix for whitelist bullets
- Add **`scripts/validate-dispatch-graph.ts`** — parses all whitelists across the 6 Agent-tool-allowlisted agents, builds dispatch graph, asserts no cycles. Hard-fails when any whitelist→whitelist→...→source path closes a loop. Wire into CI gates.
- Add regression test for the tightened regex: backtick-formatted blacklist + no whitelist → validator FAILS
- Add unit tests for cycle detection: 0-cycle graph PASSES, 2-node cycle FAILS, 3-node cycle FAILS, valid DAG with shared dependency PASSES

## Out of scope

- Implementer tier (`backend-dev`, `frontend-dev`, `fullstack-dev`) — SLICE-C, hard-gated on FEAT-161 Prong B
- `release-engineer` — SLICE-D
- Constitution + dev.stable amendments — SLICE-D
- DEC write-up (SLICE-E)
- Runtime measurement (cost, pause rate, dispatch count) — separate observability slice
- Modifying loop's `slice-build` walker — out per FEAT-163 line 125

## Acceptance criteria

- [ ] AC-1: 4 new agents (`architect`, `uxdesigner`, `qa-expert`, `performance-engineer`) contain `## Peer dispatch — when to use the Agent tool` section placed after `## Integration with Other Agents`, with whitelist matching FEAT-163 dispatch graph (FEAT body lines 43, 48, 49, 50)
- [ ] AC-2: Each new section contains: whitelist + blacklist + budgets + Dispatch prompt purity + Final-tool-call invariant + FEAT-163 cite-back (mirror SLICE-71 structure)
- [ ] AC-3: `scripts/validate-agents.ts` `PEER_DISPATCH_ALLOWLIST` extended to 6 entries (`document-writer`, `refactor`, `architect`, `uxdesigner`, `qa-expert`, `performance-engineer`). `hasWhitelistEntry` regex tightened to split at `MUST NOT dispatch` boundary
- [ ] AC-4: `scripts/validate-dispatch-graph.ts` exists, parses whitelists across the 6 allowlisted agents, hard-fails on cycle detection. Wired into a CI step in `.github/workflows/test.yml` OR exit non-zero blocking `bun run test` if a cycle is present
- [ ] AC-5: New unit tests in `tests/validate-agents-peer-dispatch.test.ts` (or new file) — backtick-blacklist + no-whitelist FAILS; 4 advisory agents all PASS via existing rule. New tests in `tests/validate-dispatch-graph.test.ts` — 0-cycle PASS, 2-node cycle FAIL, 3-node cycle FAIL, valid DAG with shared dependency PASS
- [ ] AC-6: Diff scope — only 4 agent files + 2 validator scripts + 1-2 test files. Zero edits to other agent prompts, the SLICE-71 agents (`document-writer`, `refactor`) untouched, the SLICE-70 agents untouched
- [ ] AC-7: Full CI green — `bun run lint`, `bun run format:check`, `bun run typecheck`, `bun run test`, all 4 validators exit 0
- [ ] AC-8: Verify the qa-expert ↔ performance-engineer bidirectional pair does NOT trip the cycle detector (intended exception per FEAT-163 line 50 — both advisory non-gating). Implementation hint: treat advisory pair as a documented allowlist exception in the graph validator

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
