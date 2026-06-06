# Task Handoff: FEAT-C: crew:builder-fe agent + FE codegen recipes

- Created: 2026-06-06T15:20:55.034Z
- From: builder
- To: lead
- Objective: FE specialist agent shipped; contract-codegen skill defines orval + openapi-msw FE recipes; routing-table covers FE-only and split dispatch
- Allowed Scope:
  - FEAT-C only — builder-fe.md
  - contract-codegen FE half
  - frontend-advisory polish
  - routing-table
  - topology test
  - orval fixture
- Forbidden Scope: -
- Deliverable: agents/builder-fe.md + skills/domain/contract-codegen/SKILL.md (FE half) + frontend-advisory polish + routing-table row + tests/builder-fe-prompt.test.mjs + tests/fixtures/orval/orval.config.ts
- Changed Files:
  - agents/builder-fe.md
  - skills/domain/contract-codegen/SKILL.md
  - skills/domain/frontend-advisory/SKILL.md
  - docs/routing-table.md
  - tests/builder-fe-prompt.test.mjs
  - tests/agent-topology.test.mjs
  - tests/fixtures/orval/orval.config.ts
- Confidence: high
- Risks: Routing-table rows reference crew:builder-be (FEAT-D); routing-lint:ignore marker applied. orval is a consumer-repo dep, not vendored here.
- Suggested Next Handoff: FEAT-D (builder-be) — extends contract-codegen with BE recipes, removes routing-lint:ignore on the split row

