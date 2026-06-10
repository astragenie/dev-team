---
id: SLICE-41
status: completed
feature: FEAT-117
phase: null
priority: P1
target_release: null
requires_validation: true
created: 2026-06-07
updated: 2026-06-07
completed_at: 2026-06-07
github_issue: 100
github_url: "https://github.com/sergeymilashico/hero-crew/issues/100"
---
# SLICE-41: # FEAT-117 — TS Phase 2.4: fleet module

Implements FEAT-117. See [feature file](../../../backlog/in-progress/FEAT-117.md) for product context.

## Objective

Migrate fleet.mjs (212 lines) — the worktree visibility module. Closes Phase 2.

## In scope

- bullet 1
- bullet 2

## Out of scope

- bullet 1

## Acceptance criteria

- [ ] AC-1: `scripts/lib/fleet.mjs` renamed to `.ts`; imports updated.
- [ ] AC-2: Explicit TypeScript types; no `any`; `tsc --noEmit` clean.
- [ ] AC-3: Functions >30 lines split per SRP.
- [ ] AC-4: All CI gates pass.

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-117 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
