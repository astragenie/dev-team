# Task Handoff: Brainstorming paused — crew TS port, architecture section pending approval

- Created: 2026-05-28T18:02:51Z
- From: lead
- To: lead
- Objective: Design + spec the TypeScript port of the crew plugin codebase (exact loop mirror)
- Allowed Scope: docs/superpowers/specs/ (spec write only — no code changes until design approved)
- Forbidden Scope: No code changes until design approved by user
- Deliverable: Written spec at docs/superpowers/specs/2026-05-28-typescript-port-design.md, committed, user-approved
- Changed Files: none — brainstorming only
- Confidence: high
- Risks: none — brainstorming only
- Suggested Next Handoff: after spec written + user approved, invoke writing-plans skill

## Brainstorming State

**Task tracker:**
- Task 1 Explore project context — COMPLETED
- Task 2 Ask clarifying questions — COMPLETED (all 3 Qs answered)
- Task 3 Propose 2-3 approaches — COMPLETED (Approach A chosen)
- Task 4 Present design + write spec — IN PROGRESS (architecture presented, awaiting approval)

## All Design Decisions Locked

- **Q1 strictness:** `strict: true` from Phase 1
- **Q2 build strategy:** Full compile, `src/scripts/**/*.mts` → `scripts/**/*.mjs` committed, `npm run build` in CI
- **Q3 phase scope:** 3 phases
- **Approach:** A — exact loop mirror (NodeNext, verbatimModuleSyntax, Node 22, typescript-eslint in Phase 1)

## Architecture Section (presented, awaiting approval)

**Directory layout:**
```
src/
  scripts/
    crew.mts + validate-*.mts + e2e-smoke.mts
    lib/
      *.mts  (20 files)
      briefing/*.mts
      installer/*.mts
  tests/
    *.test.mts

scripts/          ← compiled output, committed
  crew.mjs
  lib/*.mjs + briefing/ + installer/

dist/tests/       ← compiled tests, NOT committed
```

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2022", "module": "NodeNext", "moduleResolution": "NodeNext",
    "rootDir": "src", "outDir": ".", "strict": true, "noEmit": false,
    "declaration": false, "skipLibCheck": true, "resolveJsonModule": true,
    "verbatimModuleSyntax": true, "types": ["node"]
  },
  "include": ["src/**/*.mts"],
  "exclude": ["node_modules", ".claude", "docs"]
}
```

**tsconfig.test.json:** extends main, `outDir: dist/tests`, `rootDir: src/tests`, `include: src/tests/**/*.mts`

**3-FEAT structure:**
| FEAT | Phase | autonomous_safe |
|------|-------|-----------------|
| FEAT-005 | Phase 1 — mechanical rename | yes |
| FEAT-006 | Phase 2 — large file refactoring | no |
| FEAT-007 | Phase 3 — stability hardening | yes |

**Import convention:** Keep `.mjs` in all import paths — NodeNext resolves `.mjs`→`.mts` at compile time. Zero import changes in Phase 1.

## Resume Instructions

1. Re-ask: "Architecture look right, or adjust before components + CI?"
2. After approval: present **Components + CI** section:
   - package.json script changes (add build, build:tests, update typecheck, update test, update format/lint patterns)
   - CI changes (add `npm run build` + `git diff --exit-code scripts/` + `npm run build:tests`, bump Node 20→22, update format:check pattern to `src/**/*.mts`)
   - typescript-eslint config (add `typescript-eslint` overlay to eslint.config.mjs)
3. After approval: present **Migration order** section (leaf→mid→orchestrators→entry→tests, per loop pattern)
4. After approval: present **Error handling** section (parity check process, what to do on drift)
5. After approval: present **Testing** section (parity check + regression suite + Phase 2/3 integration tests)
6. After all sections approved: write spec to `docs/superpowers/specs/2026-05-28-typescript-port-design.md`
7. Self-review → user review → invoke writing-plans

## Reference

Loop spec (already read — use as template):
`C:/work/mega/hero-crew-autonomous-loop/docs/superpowers/specs/2026-05-28-typescript-port-design.md`

crew large files for Phase 2 targets:
- cost-advisor.mjs (866 lines)
- session-cost.mjs (842 lines)
- briefing/collect.mjs (764 lines)
- workflow-state.mjs (742 lines)
- artifacts.mjs (667 lines)
