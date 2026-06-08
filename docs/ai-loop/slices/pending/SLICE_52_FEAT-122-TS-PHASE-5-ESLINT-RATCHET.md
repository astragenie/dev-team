---
id: SLICE-52
status: pending
feature: FEAT-122
phase: null
priority: P2
target_release: null
requires_validation: true
created: 2026-06-08
updated: 2026-06-08
---
# SLICE-52: # FEAT-122 — TS Phase 5: ESLint ratchet

Implements FEAT-122. See [feature file](../../../backlog/in-progress/FEAT-122.md) for product context.

## Objective

Remove per-file ESLint overrides and enforce repo-wide standards: complexity ≤10, max-lines-per-function ≤30, max-lines ≤300. Ban nested ternaries. Add `@typescript-eslint/no-floating-promises`, `import/no-default-export` on scripts/lib/**.

## In scope

- bullet 1
- bullet 2

## Out of scope

- bullet 1

## Acceptance criteria

- [ ] AC-1: `eslint.config.mjs` tightened: complexity 10, max-lines-per-function 30, max-lines 300.
- [ ] AC-2: All violations fixed or waived with rationale comment.
- [ ] AC-3: `npm run lint` exits 0 (zero warnings).
- [ ] AC-4: `tsc --noEmit` clean.
- [ ] AC-5: All CI gates pass.

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-122 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
