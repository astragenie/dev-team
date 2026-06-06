# Task Handoff: FEAT-A: architect OpenAPI emission

- Created: 2026-06-06T14:43:20.531Z
- From: builder
- To: lead
- Objective: Architect now emits OpenAPI YAML (canonical) + derived TS + companion markdown
- Allowed Scope:
  - FEAT-A only — validators
  - skill
  - doc
  - agent/command edits
  - CI
- Forbidden Scope: -
- Deliverable: scripts/validate-contracts.mjs + skills/domain/openapi-authoring + docs/standards/contract-artifact-schema.md + architect/orchestrate-slice edits + CI step
- Changed Files:
  - scripts/validate-contracts.mjs
  - tests/validate-contracts.test.mjs
  - tests/fixtures/openapi/*
  - skills/domain/openapi-authoring/SKILL.md
  - docs/standards/contract-artifact-schema.md
  - agents/architect.md
  - commands/orchestrate-slice.md
  - .github/workflows/test.yml
  - package.json
  - eslint.config.mjs
  - .redocly.yaml
- Confidence: high
- Risks: e2e:smoke PASSED in this run — no FEAT-F patching required for smoke itself. All 9 gate commands exited 0 (lint, format:check, typecheck, node --test [380/380 pass], validate:manifests, validate:skills [40 ok], validate:agents [9 ok], validate:slices, validate:contracts). FEAT-F is still expected to update any fixtures that reference legacy -contracts.md paths to the new OpenAPI YAML schema.
- Suggested Next Handoff: FEAT-B (uxdesigner API touchpoints) — can start in parallel with FEAT-C/D

