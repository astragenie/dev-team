---
id: SLICE-191
parent: FEAT-189
status: triaged
priority: P1
created: 2026-07-04
title: "FEAT-189 S2 — backend-dev + frontend-dev eval specs + fixtures (highest dispatch volume)"
stack: yaml + markdown
autonomous_safe: true
est_days: 0.5
depends_on: []
touches_files:
  - evals/agents/crew-backend-dev.yaml
  - evals/agents/crew-frontend-dev.yaml
  - evals/fixtures/backend-dev-efcore-migration.txt
  - evals/fixtures/backend-dev-null-safety.txt
  - evals/fixtures/backend-dev-async-misuse.txt
  - evals/fixtures/backend-dev-held-out.txt
  - evals/fixtures/backend-dev-extra.txt
  - evals/fixtures/frontend-dev-orval-drift.txt
  - evals/fixtures/frontend-dev-a11y-regression.txt
  - evals/fixtures/frontend-dev-missing-tests.txt
  - evals/fixtures/frontend-dev-held-out.txt
  - evals/fixtures/frontend-dev-extra.txt
  - agents/backend-dev.md
  - agents/frontend-dev.md
---

# SLICE-191: backend-dev + frontend-dev eval specs (FEAT-189 S2)

## Scope
Two specs following the S1/precedent format. Flip both agents' `planned:` frontmatter → real path.

## Acceptance criteria
- AC-1: `crew-backend-dev.yaml` + `crew-frontend-dev.yaml` exist, each with candidate + judge(+gemini fallback) + validate_with + budget blocks.
- AC-2: backend-dev ≥5 fixtures covering EF Core migration mistakes, missing null-safety, async/await misuse (+held_out); frontend-dev ≥5 covering orval client drift, accessibility regression, missing test coverage on new components (+held_out). Each with an `llm-rubric`.
- AC-3: `node ./scripts/validate-agents.ts` emits no planned-eval warning for backend-dev or frontend-dev.
- AC-4: `bun run evals --dry-run --prompt backend-dev` and `--prompt frontend-dev` both run clean.

## Notes
Live judge run deferred (operator keys). Dry-run only.
