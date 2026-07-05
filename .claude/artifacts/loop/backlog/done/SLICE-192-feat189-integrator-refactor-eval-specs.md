---
id: SLICE-192
parent: FEAT-189
status: done
priority: P1
created: 2026-07-04
title: "FEAT-189 S3 — integrator + refactor eval specs + fixtures"
stack: yaml + markdown
autonomous_safe: true
est_days: 0.5
depends_on: []
touches_files:
  - evals/agents/crew-integrator.yaml
  - evals/agents/crew-refactor.yaml
  - evals/fixtures/integrator-false-pass-wireup.txt
  - evals/fixtures/integrator-missing-schema-validation.txt
  - evals/fixtures/integrator-held-out.txt
  - evals/fixtures/integrator-extra1.txt
  - evals/fixtures/integrator-extra2.txt
  - evals/fixtures/refactor-complexity-unfixed.txt
  - evals/fixtures/refactor-stale-ref-miss.txt
  - evals/fixtures/refactor-held-out.txt
  - evals/fixtures/refactor-extra1.txt
  - evals/fixtures/refactor-extra2.txt
  - agents/integrator.md
  - agents/refactor.md
---

# SLICE-192: integrator + refactor eval specs (FEAT-189 S3)

## Scope
Two specs, precedent format. Flip both agents' `planned:` frontmatter → real path.

## Acceptance criteria
- AC-1: `crew-integrator.yaml` + `crew-refactor.yaml` exist with candidate + judge(+gemini fallback) + validate_with + budget.
- AC-2: integrator ≥5 fixtures covering false-PASS on a broken live wire-up, missing OpenAPI-schema runtime validation (+held_out); refactor ≥5 covering complexity-cap violation left unfixed, stale-ref false negative (+held_out). Each `llm-rubric`.
- AC-3: `node ./scripts/validate-agents.ts` emits no planned-eval warning for integrator or refactor.
- AC-4: `bun run evals --dry-run --prompt integrator` and `--prompt refactor` run clean.

## Notes
Live judge run deferred (operator keys). Dry-run only.
