# Task Handoff: Brainstorming paused — crew TS port, architecture approval still pending

- Created: 2026-05-28T18:11:48Z
- From: lead
- To: lead
- Supersedes: 20260528T180645Z-handoff-brainstorming-ts-port-architecture-pending-approval-2.md
- Objective: Design + spec the TypeScript port of the crew plugin codebase (exact loop mirror)
- Allowed Scope: docs/superpowers/specs/ (spec write only — no code changes until design approved)
- Forbidden Scope: No code changes until design approved by user
- Deliverable: Written spec at docs/superpowers/specs/2026-05-28-typescript-port-design.md, committed, user-approved
- Changed Files: none — brainstorming only
- Confidence: high
- Risks: none
- Suggested Next Handoff: after spec written + user approved, invoke writing-plans skill

## Current State

User resumed session ("wake up"). Architecture section re-presented. **Awaiting approval.**

No state change since previous handoff (20260528T180645Z). All decisions still locked.

## All Design Decisions Locked

- **Approach:** A — exact loop mirror
- **Q1:** `strict: true` from Phase 1
- **Q2:** Full compile, `src/scripts/**/*.mts` → `scripts/**/*.mjs` committed
- **Q3:** 3 phases — FEAT-005 (mechanical rename, autonomous_safe:true) → FEAT-006 (large file refactoring, autonomous_safe:false) → FEAT-007 (hardening, autonomous_safe:true)

## Architecture Section (presented, awaiting approval)

- `src/scripts/**/*.mts` → compiles → `scripts/**/*.mjs` (committed)
- `tsconfig`: NodeNext/NodeNext, `strict: true`, `verbatimModuleSyntax: true`, `noEmit: false`, `rootDir: src`, `outDir: .`
- `tsconfig.test.json`: extends main, `outDir: dist/tests`, `rootDir: src/tests` (dist/tests NOT committed)
- Import paths stay `.mjs` — no import changes in Phase 1

## Resume Instructions

1. Re-ask: "Architecture look right, or adjust before components + CI?"
2. On approval → present Components + CI (package.json scripts, CI yaml changes, typescript-eslint)
3. On approval → Migration order (leaf → mid → orchestrators → entry → tests)
4. On approval → Error handling (parity check, drift response)
5. On approval → Testing section
6. Write spec → self-review → user review → writing-plans

## Also Pending (separate)

- Lead involvement spec review: `docs/superpowers/specs/2026-05-28-lead-involvement-design.md` → writing-plans
- FEAT-024 in hero-crew-autonomous-loop repo
- 2 commits ahead of origin/main (push when convenient)
