---
id: SLICE-36
status: completed
feature: FEAT-112
phase: null
priority: P1
target_release: null
requires_validation: true
created: 2026-06-07
updated: 2026-06-07
completed_at: 2026-06-07
github_issue: 90
github_url: "https://github.com/sergeymilashico/hero-crew/issues/90"
---
# SLICE-36: # FEAT-112 — TS Phase 1.7: installer leaf modules

Implements FEAT-112. See [feature file](../../../backlog/in-progress/FEAT-112.md) for product context.

## Objective

Migrate 4 small installer leaf modules. These are pure utility files with

## In scope

- bullet 1
- bullet 2

## Out of scope

- bullet 1

## Acceptance criteria

- [ ] AC-1: `scripts/lib/installer/util.mjs` renamed to `.ts`; imports updated.
- [ ] AC-2: `scripts/lib/installer/gitignore.mjs` renamed to `.ts`; imports updated.
- [ ] AC-3: `scripts/lib/installer/templates.mjs` renamed to `.ts`; imports updated.
- [ ] AC-4: `scripts/lib/installer/welcome.mjs` renamed to `.ts`; imports updated.
- [ ] AC-5: Explicit TypeScript types; no `any`; `tsc --noEmit` clean.
- [ ] AC-6: Dead code removed.
- [ ] AC-7: All CI gates pass.

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-112 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
