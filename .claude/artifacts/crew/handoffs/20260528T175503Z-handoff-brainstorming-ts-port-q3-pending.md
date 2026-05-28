# Task Handoff: Brainstorming paused — crew TypeScript port, Q3 pending

- Created: 2026-05-28T17:55:03Z
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
- Task 2 Ask clarifying questions — IN PROGRESS (Q1+Q2 answered, Q3 posed)
- Task 3 Propose 2-3 approaches — pending
- Task 4 Present design + write spec — pending

## Design Decisions Locked

- **Q1 strictness:** `strict: true` from Phase 1 — matches loop repo exactly
- **Q2 build strategy:** Full compile, `src/scripts/**/*.mts` → `scripts/**/*.mjs` (committed), `npm run build` gate in CI. Matches loop pattern exactly.

## Q3 Posed (awaiting answer)

Phase scope — how many phases?

- **A** — 3 phases (match loop): Phase 1 mechanical rename (zero logic), Phase 2 refactoring, Phase 3 hardening
- **B** — 2 phases: Phase 1 mechanical + strict types together, Phase 2 refactoring
- **C** — 1 phase: everything at once

Recommendation given: **A** — 3 phases, matches loop's proven split.

## Context Gathered

**crew repo (C:/work/mega/hero-crew):**
- 66 `.mjs` files in `scripts/`, no .ts files
- Currently `allowJs + checkJs + noImplicitAny + noImplicitThis`, `strict: false`, `noEmit: true`
- Module target: `ESNext / Bundler` (will change to `NodeNext/NodeNext` post-port)
- No build step — will add `npm run build` + `build:tests`
- CI: Node 20, 9 gates
- Largest files: cost-advisor.mjs (866 lines), session-cost.mjs (842), briefing/collect.mjs (764), workflow-state.mjs (742), artifacts.mjs (667)
- Has `typescript: ^6.0.3`, `@types/node: ^25.9.1` already

**loop repo reference:**
- `strict: true`, `NodeNext/NodeNext`, `verbatimModuleSyntax: true`, `noEmit: false`
- `src/scripts/**/*.mts` → `scripts/**/*.mjs` committed
- 3 phases: FEAT-021 (mechanical), FEAT-022 (refactoring), FEAT-023 (hardening)
- Spec: `C:/work/mega/hero-crew-autonomous-loop/docs/superpowers/specs/2026-05-28-typescript-port-design.md`
- CI: Node 22, `git diff --exit-code scripts/` gate, `build:tests` step

## Resume Instructions

1. Re-ask Q3 (phase scope): A / B / C as above.
2. After Q3 answered: move to Task 3 — propose 2-3 approaches (overall port strategy options).
3. After approach chosen: present design sections one at a time (architecture → components → migration phases → CI changes → risks/rollback).
4. Write spec to `docs/superpowers/specs/2026-05-28-typescript-port-design.md`.
5. Self-review → user review → invoke writing-plans.

## Reference

Loop repo spec (read as reference design before proposing):
`C:/work/mega/hero-crew-autonomous-loop/docs/superpowers/specs/2026-05-28-typescript-port-design.md`
