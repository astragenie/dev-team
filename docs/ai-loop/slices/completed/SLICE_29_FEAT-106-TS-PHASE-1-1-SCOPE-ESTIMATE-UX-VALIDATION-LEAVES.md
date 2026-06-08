---
id: SLICE-29
status: completed
feature: FEAT-106
phase: null
priority: P1
target_release: null
requires_validation: true
created: 2026-06-07
updated: 2026-06-07
completed_at: 2026-06-07
github_issue: 78
github_url: "https://github.com/sergeymilashico/hero-crew/issues/78"
---
# SLICE-29: # FEAT-106 — TS Phase 1.1: scope-estimate + ux-validation leaves

Implements FEAT-106. See [feature file](../../../backlog/in-progress/FEAT-106.md) for product context.

## Objective

Kick off leaf-up TS migration. These 3 files are pure leaf modules (no

## In scope

- bullet 1
- bullet 2

## Out of scope

- bullet 1

## Acceptance criteria

- [ ] AC-1: `scripts/lib/scope-estimate.mjs` renamed to `.ts`; all imports updated.
- [ ] AC-2: `scripts/lib/ux-validation/classify-scenario.mjs` renamed to `.ts`; imports updated.
- [ ] AC-3: `scripts/lib/ux-validation/discover-playwright.mjs` renamed to `.ts`; imports updated.
- [ ] AC-4: Each migrated file has explicit TypeScript types (no `any`); `tsc --noEmit` clean.
- [ ] AC-5: Dead code surfaced by `noUnusedLocals`/`noUnusedParameters` removed.
- [ ] AC-6: `Result<T,E>` applied where errors are domain-meaningful.
- [ ] AC-7: All CI gates pass: lint, format:check, typecheck, `npm test`, e2e:smoke.

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-106 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
