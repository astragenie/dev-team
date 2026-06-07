---
id: FEAT-123
title: Diagram authoring POC for architect — auto-pick + templates + lint
priority: P2
status: triaged
category: feature
target_release: null
autonomous_safe: false
cross_repo: null
parent_spec: null
plan: null
related: [FEAT-124]
phase: null
tags: ["surface:skills", "surface:agents", "concern:dx", "concern:docs"]
pm_customer_impact: 0.35
pm_demand_signal: null
pm_technical_feasibility: 0.7
pm_scope_risk: 0.55
pm_strategic_alignment: 0.4
pm_composite: 0.5
updated: 2026-06-07
created: 2026-06-07
triaged_at: 2026-06-07
triage_notes: "autonomous_safe=false: adds new skills + edits agent routing in architect/document-writer; 3-in-1 scope (auto-pick + templates + lint) benefits from human-reviewed skill authorship per loop-discipline."
slices: []
depends_on: []
---

# Diagram authoring POC for architect — auto-pick + templates + lint

POC enabling architect/document-writer agents to author technical diagrams
end-to-end. Builds on existing `skills/domain/diagram-methodology/` (format
selection table + decision tree already present).

## Scope (3-in-1)

1. **Auto-pick diagram type** — given task context (ADR? sequence flow? data
   model?) recommend Mermaid/PlantUML/ASCII + diagram class (C4, sequence,
   ERD, state, flowchart). Lives as decision section in
   `diagram-methodology` SKILL.md OR new `skills/workflow/diagram-routing/`.
2. **Template library** — `skills/domain/diagram-methodology/templates/`
   with seed stubs:
   - `c4-context.mmd`, `c4-container.mmd`
   - `sequence-api.mmd`
   - `erd-postgres.mmd`
   - `state-auth.mmd`
   - `flowchart-decision.mmd`
   - `adr-arch.mmd`
3. **Diagram lint/review** — new `skills/workflow/diagram-review/SKILL.md`:
   Mermaid syntax sanity, slop pattern detection (overloaded boxes, missing
   labels, anti-patterns).

## Integration

Route through **`loop:document-writer`** (preferred — Markdown owner) for
authoring, **`loop:architect`** for type selection. Update
`docs/routing-table.md`.

## Acceptance criteria

- [ ] `diagram-methodology` SKILL.md extended with auto-pick decision rules
      OR new `diagram-routing` skill exists
- [ ] `templates/` dir populated with ≥6 stubs covering C4 (2), sequence (1),
      ERD (1), state (1), flowchart (1)
- [ ] `diagram-review` skill catches ≥3 categories of issues
- [ ] `routing-table.md` row added:
      "Diagram authoring → `loop:document-writer` (consults
      `diagram-methodology`, `diagram-review`)"
- [ ] 1 architect or doc-writer dispatch produces lint-clean Mermaid diagram
      from template

## Out of scope

- Visual rendering pipeline (Mermaid → PNG export)
- Draw.io interactive editing integration
- Diagram versioning / diff tooling
