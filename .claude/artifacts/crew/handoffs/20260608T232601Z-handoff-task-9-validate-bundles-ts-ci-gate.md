# Task Handoff: Task 9: validate-bundles.ts CI gate

- Created: 2026-06-08T23:26:01.464Z
- From: builder
- To: lead
- Objective: Created scripts/validate-bundles.ts, wired into package.json and CI workflow as a hard gate that validates build-bundle frontmatter.
- Allowed Scope:
  - scripts/validate-bundles.ts (new)
  - package.json (validate:bundles script)
  - .github/workflows/test.yml (new step)
- Forbidden Scope: -
- Deliverable: Hard CI gate: walks .claude/artifacts/crew/bundles/**/*-build-bundle.md, validates required fields + schema_version, exits 1 on malformed; script + CI step committed.
- Changed Files:
  - scripts/validate-bundles.ts
  - package.json
  - .github/workflows/test.yml
- Confidence: high
- Risks: none
- Suggested Next Handoff: Task 10 — update builder/reviewer agent prompts to reference build-bundle tooling

