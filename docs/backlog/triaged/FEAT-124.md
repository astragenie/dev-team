---
id: FEAT-124
title: Consolidate crew:copywriter → loop:document-writer
priority: P2
status: triaged
category: refactor
target_release: null
autonomous_safe: false
cross_repo: hero-crew,loop
parent_spec: null
plan: null
related: [FEAT-123]
phase: null
tags: ["surface:agents", "concern:dx", "concern:naming"]
pm_customer_impact: 0.4
pm_demand_signal: null
pm_technical_feasibility: 0.55
pm_scope_risk: 0.7
pm_strategic_alignment: 0.45
pm_composite: 0.525
updated: 2026-06-07
created: 2026-06-07
triaged_at: 2026-06-07
triage_notes: "autonomous_safe=false: cross-repo (hero-crew + loop marketplace coordination) and agent prompt edits to loop:document-writer; coordinated release requires human approval per loop rules."
slices: []
depends_on: []
---

# Consolidate crew:copywriter → loop:document-writer

Two overlapping doc-writer agents exist:

- `crew:copywriter` (hero-crew) — API docs, release notes, README, diagram
  captions, dev-facing content
- `loop:document-writer` (loop) — README, CHANGELOG, ADRs, retros, SPEC
  bodies, agent/skill prompts, release notes

Scope overlap creates routing ambiguity. Consolidate to single agent.

## Approach

1. **Deprecate** `agents/copywriter.md` in hero-crew (mark deprecated, keep
   shim that re-routes for one release cycle).
2. **Migrate scope** — anything `crew:copywriter` did that
   `loop:document-writer` doesn't already cover (API docs, OpenAPI doc gen,
   diagram captions) moves into `loop:document-writer` agent prompt.
3. **Update routing-table.md** — replace all `crew:copywriter` rows with
   `loop:document-writer`.
4. **Update agent references** in commands, skills, other agent prompts
   (grep `crew:copywriter` across both repos).
5. **CHANGELOG note** on hero-crew side; corresponding scope-bump entry on
   loop side.

## Acceptance criteria

- [ ] `agents/copywriter.md` marked deprecated with re-route note
- [ ] `loop:document-writer` prompt extended to cover API docs + diagram
      captions
- [ ] `docs/routing-table.md` no longer references `crew:copywriter`
- [ ] grep `crew:copywriter` across both repos returns 0 active refs
      (deprecation notice + CHANGELOG excluded)
- [ ] CHANGELOG.md entry in both repos
- [ ] Release coordinated: hero-crew patch bump + loop minor bump

## Out of scope

- Renaming any other crew/loop agents
- Touching `crew:uxdesigner` (different scope)

## Risks

- Cross-repo coordination required — loop is separate marketplace entry
- Users with `crew:copywriter` in custom workflows need migration notice
