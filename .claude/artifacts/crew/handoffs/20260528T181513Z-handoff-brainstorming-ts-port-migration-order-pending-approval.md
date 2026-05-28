# Task Handoff: Brainstorming paused — crew TS port, migration order pending approval

- Created: 2026-05-28T18:15:13Z
- From: lead
- To: lead
- Supersedes: 20260528T181236Z-handoff-brainstorming-ts-port-components-ci-pending-approval.md
- Objective: Design + spec the TypeScript port of the crew plugin codebase (exact loop mirror)
- Allowed Scope: docs/superpowers/specs/ (spec write only — no code changes until design approved)
- Forbidden Scope: No code changes until design approved by user
- Deliverable: Written spec at docs/superpowers/specs/2026-05-28-typescript-port-design.md, committed, user-approved
- Changed Files: none — brainstorming only
- Confidence: high
- Risks: none
- Suggested Next Handoff: after spec written + user approved, invoke writing-plans skill

## Design Sections Status

- Architecture — **APPROVED**
- Components + CI — **APPROVED**
- Migration order — **PRESENTED, awaiting approval**
- Error handling — pending
- Testing — pending
- Spec write → self-review → user review → writing-plans — pending

## Migration Order Section (presented, awaiting approval)

6 groups, lowest-risk-first. Each group = one commit. Parity check (`git diff scripts/`) after each.

| Group | Files | Notes |
|-------|-------|-------|
| 1 — Leaf utilities | util.mjs, paths.mjs, frontmatter.mjs, outcome-linkage.mjs, git-helpers.mjs | No lib/ imports |
| 2 — Mid-level utilities | config-resolver.mjs, backlog-parser.mjs, event-log.mjs, claims.mjs | Import Group 1 only |
| 3 — Core lib | workflow-state.mjs, artifacts.mjs, wakeup.mjs, session-cost.mjs, cost-advisor.mjs | Import Groups 1+2 |
| 4 — Compound modules | briefing/collect.mjs, briefing/render.mjs, installer/*.mjs, installer.mjs | Submodule dirs |
| 5 — Entry scripts | crew.mts, validate-*.mts, e2e-smoke.mts | Top-level scripts |
| 6 — Tests | tests/*.test.mts | Last — depend on all lib |

Parity check per group: `npm run build && git diff scripts/` — whitespace/comments only; any logic diff = stop and fix.

## Resume Instructions

1. Re-ask: "Migration order look right, or adjust before error handling?"
2. On approval → **Error handling**: parity drift response (stop+fix rule, what counts as acceptable diff), Phase 1 rollback if parity fails badly.
3. On approval → **Testing**: parity check as CI gate, regression suite unchanged, Phase 2/3 integration test targets.
4. Write spec → self-review → user review → writing-plans.

## Reference

Loop spec: `C:/work/mega/hero-crew-autonomous-loop/docs/superpowers/specs/2026-05-28-typescript-port-design.md`
Phase 2 targets: cost-advisor.mjs (866L), session-cost.mjs (842L), briefing/collect.mjs (764L), workflow-state.mjs (742L), artifacts.mjs (667L)
