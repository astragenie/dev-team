# Task Handoff: FEAT-D: crew:builder-be agent + per-stack codegen

- Created: 2026-06-06T15:35:19.238Z
- From: builder
- To: lead
- Objective: BE specialist agent shipped; contract-codegen now covers C#/Python/Go/Node recipes; routing-table covers BE-only dispatch
- Allowed Scope:
  - FEAT-D only — builder-be.md
  - contract-codegen BE half (factored into per-stack sub-files)
  - routing-table
  - topology test
- Forbidden Scope: -
- Deliverable: agents/builder-be.md + skills/domain/contract-codegen/{SKILL.md, be-csharp.md, be-python.md, be-go.md, be-node.md, loop-json-schema.md} + routing-table row + tests
- Changed Files:
  - agents/builder-be.md
  - skills/domain/contract-codegen/SKILL.md
  - skills/domain/contract-codegen/be-csharp.md
  - skills/domain/contract-codegen/be-python.md
  - skills/domain/contract-codegen/be-go.md
  - skills/domain/contract-codegen/be-node.md
  - skills/domain/contract-codegen/loop-json-schema.md
  - docs/routing-table.md
  - tests/builder-be-prompt.test.mjs
  - tests/agent-topology.test.mjs
- Confidence: high
- Risks: csharp-pro / python-pro / go-pro skills not authored in this FEAT — slice 1 of any FEAT that uses them must include skill authorship. Correction to plan: routing-lint:ignore markers exist for Signal-column pseudo-ID false positives (not crew:builder-be missing as originally hypothesized); markers preserved on all 3 split/FE/BE rows.
- Suggested Next Handoff: FEAT-E (integrator) — depends on FEAT-C+D, both now shipped

