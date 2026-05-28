# Task Handoff: Brainstorming paused — crew TypeScript port, approach choice pending

- Created: 2026-05-28T17:58:56Z
- From: lead
- To: lead
- Objective: Design + spec the TypeScript port of the crew plugin codebase, informed by loop repo's existing port design
- Allowed Scope: docs/superpowers/specs/ (spec write only — no code changes until design approved)
- Forbidden Scope: No code changes until design approved by user
- Deliverable: Written spec at docs/superpowers/specs/YYYY-MM-DD-typescript-port-design.md, committed, user-approved
- Changed Files: none — brainstorming only
- Confidence: high
- Risks: none — brainstorming only
- Suggested Next Handoff: after spec written + user approved, invoke writing-plans skill

## Brainstorming State

**Task tracker:**
- Task 1 Explore project context — COMPLETED
- Task 2 Ask clarifying questions — COMPLETED
- Task 3 Propose 2-3 approaches — IN PROGRESS (approaches presented, awaiting user choice)
- Task 4 Present design sections + write spec — pending

## Design Decisions Locked (all Qs answered)

- **Q1 strictness:** `strict: true` from Phase 1 — matches loop
- **Q2 build strategy:** Full compile, `src/scripts/**/*.mts` → `scripts/**/*.mjs` (committed output), `npm run build` in CI
- **Q3 phase scope:** 3 phases — Phase 1 mechanical rename, Phase 2 refactoring, Phase 3 hardening

## 3 Approaches Presented (awaiting choice)

**Approach A — Exact loop mirror**
Copy loop spec verbatim: NodeNext, verbatimModuleSyntax, strict, committed output, Node 22 bump in Phase 1, typescript-eslint in Phase 1. Maximum cross-repo consistency.
Tradeoff: Node 20→22 orthogonal to TS migration, increases Phase 1 blast radius.

**Approach B (Recommended) — Loop architecture, crew-calibrated**
Same core (NodeNext, verbatimModuleSyntax, strict, committed output). Differ:
- Keep CI at Node 20 in Phase 1 (bump 20→22 as separate FEAT)
- Add typescript-eslint in Phase 2, not Phase 1
Phase 1 = pure mechanical rename, autonomous_safe: true. Phase 2 = crew's 5 large files (cost-advisor 866L, session-cost 842L, briefing/collect 764L, workflow-state 742L, artifacts 667L), autonomous_safe: false. Phase 3 = integration tests + CI hardening.

**Approach C — Loop Phase 1 only**
Spec and implement Phase 1 only. Phases 2+3 deferred to backlog with no pre-commitment.

## Resume Instructions

1. Re-present 3 approaches, ask user to choose A/B/C.
2. After choice: move to Task 4 — present design sections one at a time:
   - Architecture (tsconfig shape, directory layout, compiled output model)
   - Components (what changes in each phase: scripts, package.json, CI)
   - Migration order (leaf → mid → orchestrators → entry → tests)
   - Error handling (parity check process, what to do on drift)
   - Testing strategy
3. Get approval after each section.
4. Write spec to `docs/superpowers/specs/2026-05-28-typescript-port-design.md`.
5. Self-review → user review → invoke writing-plans.

## Key Context

**crew repo state:**
- 66 `.mjs` files in `scripts/`, `allowJs + checkJs + noImplicitAny`, `noEmit: true`, no build step
- Largest files: cost-advisor.mjs (866L), session-cost.mjs (842L), briefing/collect.mjs (764L), workflow-state.mjs (742L), artifacts.mjs (667L)
- CI: Node 20, 9 gates
- Already has `typescript: ^6.0.3`, `@types/node: ^25.9.1`

**Loop repo spec (reference — already read):**
`C:/work/mega/hero-crew-autonomous-loop/docs/superpowers/specs/2026-05-28-typescript-port-design.md`
Key: NodeNext + verbatimModuleSyntax + strict + src/→scripts/ committed + tsconfig.test.json + parity check. Import convention: use `.mjs` in import paths (NodeNext resolves .mjs→.mts at compile time).
