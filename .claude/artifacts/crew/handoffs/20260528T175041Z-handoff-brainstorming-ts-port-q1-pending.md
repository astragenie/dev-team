# Task Handoff: Brainstorming paused — crew TypeScript port, Q1 pending

- Created: 2026-05-28T17:50:41Z
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
- Task 2 Ask clarifying questions — IN PROGRESS (Q1 posed, awaiting answer)
- Task 3 Propose 2-3 approaches — pending
- Task 4 Present design + write spec — pending

## Context Gathered (Task 1)

**crew repo (C:/work/mega/hero-crew):**
- 66 `.mjs` files in `scripts/` (no .ts files)
- Already using `allowJs + checkJs + noImplicitAny + noImplicitThis`, `strict: false`
- `noEmit: true` — TypeScript checks only, NO compilation
- Module target: `ESNext / Bundler`
- No build step — plugin .mjs files run directly
- CI: Node 20, 9 gates (lint, format, typecheck, test, e2e:smoke, validate-manifests/skills/slices)
- Largest files: cost-advisor.mjs (866), session-cost.mjs (842), briefing/collect.mjs (764), workflow-state.mjs (742), artifacts.mjs (667)
- Has `typescript: ^6.0.3`, `@types/node: ^25.9.1` already

**loop repo (C:/work/mega/hero-crew-autonomous-loop):**
- Already actively migrating — 99 `.mts` files in `src/scripts/`
- `strict: true`, `NodeNext/NodeNext`, `verbatimModuleSyntax: true`
- `noEmit: false` — compiles `src/scripts/*.mts` → `scripts/*.mjs`
- Committed output (scripts/ committed post-build, CI checks `git diff --exit-code scripts/`)
- 3-phase design: Phase 1 (mechanical rename), Phase 2 (refactoring), Phase 3 (stability)
- Spec at: `docs/superpowers/specs/2026-05-28-typescript-port-design.md` (in loop repo)
- CI: Node 22 (crew uses Node 20 — version gap to consider)
- Has `typescript-eslint: ^8.60.0` overlay

**Key deltas crew vs loop:**
- crew: check-only → loop: full compile
- crew: ESNext/Bundler → loop: NodeNext/NodeNext (stricter ESM interop)
- crew: no build step → loop: `npm run build` required before test
- crew: strict:false → loop: strict:true
- crew: CI Node 20 → loop: CI Node 22

## Q1 Posed (awaiting answer)

What strictness target for crew's TypeScript port?

- **A** — Match loop: `strict: true` from Phase 1. Consistent cross-repo, catches more bugs, harder Phase 1.
- **B** — Start permissive (keep current flags), add strictness in Phase 2/3. Easier mechanical rename, defer annotation work.
- **C** — `strict: true` with select overrides (e.g. `noUncheckedIndexedAccess: false`). Middle ground.

## Resume Instructions

1. Re-ask Q1 (strictness): A / B / C as above.
2. After Q1: ask Q2 — Build strategy: (A) full compile like loop (src/ → scripts/), (B) stay check-only but switch to .mts extension, (C) something else.
3. After Q2: ask Q3 — Phase scope: match loop's 3 phases, or different?
4. After all Qs: propose 2-3 approaches.
5. Present design sections, get approval after each.
6. Write spec to `docs/superpowers/specs/2026-05-28-typescript-port-design.md` (or similar date).
7. Self-review → user review → invoke writing-plans.

## Reference

Loop repo spec (read this for reference design):
`C:/work/mega/hero-crew-autonomous-loop/docs/superpowers/specs/2026-05-28-typescript-port-design.md`
