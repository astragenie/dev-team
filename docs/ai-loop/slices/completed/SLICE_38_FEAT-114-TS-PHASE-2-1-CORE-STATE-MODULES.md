---
id: SLICE-38
status: completed
feature: FEAT-114
phase: null
priority: P1
target_release: null
requires_validation: true
created: 2026-06-07
updated: 2026-06-07
completed_at: 2026-06-07
github_issue: 94
github_url: "https://github.com/sergeymilashico/hero-crew/issues/94"
---
# SLICE-38: # FEAT-114 — TS Phase 2.1: core state modules

Implements FEAT-114. See [feature file](../../../backlog/in-progress/FEAT-114.md) for product context.

## Objective

Migrate the three core state management modules. These are the most-imported

## In scope

- bullet 1
- bullet 2

## Out of scope

- bullet 1

## Acceptance criteria

- [ ] AC-1: `scripts/lib/workflow-state.mjs` renamed to `.ts`; split into read/mutate per ISP (>300 lines).
- [ ] AC-2: `scripts/lib/claims.mjs` renamed to `.ts`; imports updated.
- [ ] AC-3: `scripts/lib/approvals.mjs` renamed to `.ts`; imports updated.
- [ ] AC-4: Explicit TypeScript types; no `any`; `tsc --noEmit` clean.
- [ ] AC-5: Dead code removed.
- [ ] AC-6: `Result<T,E>` applied to claim, approval resolve, badge set operations.
- [ ] AC-7: Discriminated unions for workflow gate state (`{ status: 'pending' | 'passed' | 'failed' | 'skipped'; ... }`).
- [ ] AC-8: Functions >30 lines split per SRP.
- [ ] AC-9: All CI gates pass.

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-114 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
