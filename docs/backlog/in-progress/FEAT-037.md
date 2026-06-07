---
id: FEAT-037
title: Cross-agent severity signals + brief-me health aggregation
priority: P2
status: in-progress
category: observability
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: null
related: []
phase: null
triage_notes: "autonomous_safe inferred: AC count=8, derived_from=null → true"
updated: 2026-06-07
started_at: 2026-06-07
slices: [SLICE-17]
---
# FEAT-037 — Cross-agent severity signals + brief-me health aggregation

## Why

Current crew agents emit unstructured prose in artifacts. Reviewer findings, builder risks,
validator evidence, and deployer health are readable only by opening individual artifact files.
brief-me has no run-level health summary.

This feature adds structured 3-tier severity signals (🔴 bug · 🟡 risk · ❓ question),
role-adapted per agent, that surface in artifact CLI fields AND aggregate into brief-me's
run health summary.

## Approach (deferred — decide at triage)

Three options explored during brainstorm 2026-06-04:

**A — Agent prompt convention + text scraping** (fast, fragile)
**B — CLI schema fields + collect.mjs aggregation** (recommended — structured, reliable)
**C — Markdown `## Signals` table in artifact body, no brief-me aggregation** (clean artifacts, misses brief-me goal)

Recommendation at brainstorm time: Approach B.

## Scope (Approach B)

- Add `--findings "🔴:N,🟡:N,❓:N"` flag to `write-review-result`, `write-validation-result`, `write-deployment-check`
- Role-specific signal adaptation per agent prompt:
  - builder → confidence + scope-drift
  - reviewer → 🔴🟡❓ findings (extends cavecrew-reviewer pattern)
  - validator → pass/partial/fail + per-scenario signals
  - deployer → healthy/degraded/down per environment
- `scripts/lib/briefing/collect.mjs` reads structured findings field
- brief-me surfaces run health: `2🔴 1🟡 across reviewer+validator`

## Acceptance criteria

- [ ] AC-1: `write-review-result --findings` flag accepted and persisted in artifact frontmatter
- [ ] AC-2: `write-validation-result --findings` flag accepted and persisted
- [ ] AC-3: `write-deployment-check --findings` flag accepted and persisted
- [ ] AC-4: reviewer.md prompt emits structured `🔴:N,🟡:N,❓:N` in `--findings`
- [ ] AC-5: validator.md and deployer.md prompts emit role-adapted signals
- [ ] AC-6: brief-me JSON includes `runHealth` field when findings present
- [ ] AC-7: brief-me briefing renders run health summary (e.g. `2🔴 1🟡 across reviewer+validator`)
- [ ] AC-8: existing tests pass; new tests cover findings parsing and runHealth aggregation
