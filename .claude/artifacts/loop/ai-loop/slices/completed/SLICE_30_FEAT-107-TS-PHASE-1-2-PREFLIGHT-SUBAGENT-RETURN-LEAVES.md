---
id: SLICE-30
status: completed
feature: FEAT-107
phase: null
priority: P1
target_release: null
requires_validation: true
created: 2026-06-07
updated: 2026-06-07
completed_at: 2026-06-07
github_issue: 80
github_url: "https://github.com/sergeymilashico/hero-crew/issues/80"
---
# SLICE-30: # FEAT-107 — TS Phase 1.2: preflight + subagent-return leaves

Implements FEAT-107. See [feature file](../../../backlog/in-progress/FEAT-107.md) for product context.

## Objective

Continue leaf-up TS migration with 2 leaf modules: preflight checks and

## In scope

- bullet 1
- bullet 2

## Out of scope

- bullet 1

## Acceptance criteria

- [ ] AC-1: `scripts/lib/preflight/checks.mjs` renamed to `.ts`; imports updated.
- [ ] AC-2: `scripts/lib/subagent-return/check.mjs` renamed to `.ts`; imports updated.
- [ ] AC-3: Explicit TypeScript types; no `any`; `tsc --noEmit` clean.
- [ ] AC-4: Dead code removed; `noUnusedLocals`/`noUnusedParameters` violations fixed.
- [ ] AC-5: `Result<T,E>` applied where domain errors are meaningful.
- [ ] AC-6: All CI gates pass.

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-107 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
