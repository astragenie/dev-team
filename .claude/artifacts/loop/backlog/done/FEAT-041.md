---
id: FEAT-041
title: journey-builder sub-skill for ux-validation end-to-end journey mode
priority: P2
status: triaged
category: workflow
target_release: null
autonomous_safe: false
cross_repo: null
parent_spec: docs/superpowers/specs/2026-06-05-journey-builder-ux-validation-design.md
related: []
phase: null
tags: ["stack:typescript", "surface:cli", "concern:ux"]
github_issue: 57
github_milestone: null
github_url: "https://github.com/sergeymilashico/hero-crew/issues/57"
created: 2026-06-10
depends_on: []
slices: []
---
# FEAT-041 — journey-builder sub-skill for ux-validation

## Why

`ux-validation` validates UI changes per-AC in parallel. It cannot validate a full
user journey (login → create → publish) because it has no concept of ordered steps.
Adding a `journey-builder` sub-skill gives the validator an ordered `scenario_chain`
derived from either an explicit `## User Journey` section in the slice file or
auto-derived from the AC list. This produces end-to-end evidence scoped to the
current slice's changes.

## Spec

`docs/superpowers/specs/2026-06-05-journey-builder-ux-validation-design.md`

## Acceptance criteria

- [ ] AC-1: `skills/workflow/journey-builder/SKILL.md` exists with correct tier, triggers, input/output contract
- [ ] AC-2: `scripts/lib/ux-validation/journey-builder.mjs` exports `buildJourney(acs, sliceContent)`
- [ ] AC-3: Explicit `## User Journey` override parsed correctly per format spec
- [ ] AC-4: Auto-derive orders ACs by nav → input → action → assertion, ties by document order
- [ ] AC-5: `buildJourney` returns `[]` when < 2 steps derivable
- [ ] AC-6: `ux-validation` SKILL.md has Step 2.5 calling `journey-builder`
- [ ] AC-7: `qa-adapter.mjs` `buildQaInvocation` accepts `scenario_chain`; backward compat preserved
- [ ] AC-8: Mid-chain `/qa` failure records per-step evidence, does not abort
- [ ] AC-9: All 8 `journey-builder.test.mjs` tests pass
- [ ] AC-10: `node --test`, `npm run lint`, `npm run format:check`, `validate-skills.mjs` all clean
