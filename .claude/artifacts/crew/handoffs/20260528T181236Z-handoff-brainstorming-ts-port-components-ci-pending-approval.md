# Task Handoff: Brainstorming paused — crew TS port, Components+CI pending approval

- Created: 2026-05-28T18:12:36Z
- From: lead
- To: lead
- Supersedes: 20260528T181148Z-handoff-brainstorming-ts-port-architecture-approval-still-pending.md
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
- Components + CI — **PRESENTED, awaiting approval**
- Migration order — pending
- Error handling — pending
- Testing — pending
- Spec write → self-review → user review → writing-plans — pending

## All Design Decisions Locked

- **Approach:** A — exact loop mirror
- **strict: true** from Phase 1, full compile, 3 phases
- FEATs: 005 (mechanical rename, autonomous_safe:true) → 006 (large file refactoring, autonomous_safe:false) → 007 (hardening, autonomous_safe:true)

## Components + CI Section (presented, awaiting approval)

### package.json changes
- Add: `build`, `build:tests`
- Replace `typecheck`: `tsc --project tsconfig.json --noEmit && tsc --project tsconfig.test.json --noEmit`
- Replace `test`: `npm run build && npm run build:tests && node --test dist/tests/*.test.mjs`
- Replace `lint` path: `scripts/**/*.mjs` → `src/**/*.mts` (+ tests)
- Replace `format`/`format:check` path: `src/**/*.mts`
- Add `typescript-eslint ^8.60.0` to devDependencies

### eslint.config.mjs
Add typescript-eslint overlay for `src/**/*.mts` files with `tsconfigs.configs.recommended` and `project: ./tsconfig.json`.

### CI (.github/workflows/test.yml)
- Bump Node 20 → 22
- Add after npm ci: `npm run build` + `git diff --exit-code scripts/` (drift guard)
- Add before test: `npm run build:tests`
- Change test run: `node --test dist/tests/*.test.mjs` (was `node --test`)
- Typecheck now checks both tsconfig.json + tsconfig.test.json

## Resume Instructions

1. Re-ask: "Components + CI look right, or adjust before migration order?"
2. On approval → present **Migration order** section:
   - Leaf modules first (no imports from other lib files — e.g. paths.mjs, util.mjs, frontmatter.mjs)
   - Mid-level utilities next
   - Gate/orchestrator modules
   - Entry scripts (crew.mts, validate-*.mts, e2e-smoke.mts)
   - Tests last
   - Each group = one commit; parity check after each group
3. On approval → **Error handling** (parity check process: `git diff scripts/` after build, stop+fix on any logic diff)
4. On approval → **Testing** (parity check + existing regression suite + Phase 2/3 integration tests)
5. Write spec → self-review → user review → writing-plans

## Reference

Loop spec (already read):
`C:/work/mega/hero-crew-autonomous-loop/docs/superpowers/specs/2026-05-28-typescript-port-design.md`

Crew Phase 2 targets:
- cost-advisor.mjs (866L), session-cost.mjs (842L), briefing/collect.mjs (764L), workflow-state.mjs (742L), artifacts.mjs (667L)
