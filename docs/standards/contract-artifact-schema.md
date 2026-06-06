# Contract artifact schema

A FEAT contract artifact is **three files**, all FEAT-scoped (shared across slices of the FEAT):

| File                                                                  | Source of truth?         | Hand-authored?    |
| --------------------------------------------------------------------- | ------------------------ | ----------------- |
| `.claude/artifacts/crew/designs/<FEAT-ID>-contracts.openapi.yaml`     | YES                      | YES               |
| `.claude/artifacts/crew/designs/<FEAT-ID>-contracts.ts`               | NO (derived)             | NO (regenerated)  |
| `.claude/artifacts/crew/designs/<FEAT-ID>-contracts.md`               | YES (for non-wire content) | YES             |

## YAML (canonical)

OpenAPI 3.1. Quality bar enforced by `skills/domain/openapi-authoring/SKILL.md` and `scripts/validate-contracts.mjs`. See the skill for mandatory shape and custom extensions.

## TS (derived)

Regenerated from the YAML by `openapi-typescript` and committed. The commit purpose is IDE convenience — developers `import type { paths } from '...-contracts.ts'`. CI (`scripts/validate-contracts.mjs`) hashes the regenerated TS against the committed copy; drift fails CI.

## Markdown (companion)

Narrows to:

```markdown
## Decision rationale
why this surface shape; alternatives considered; tradeoffs

## Data Contracts
DB tables, indexes, foreign keys, migration intent
(no wire-type duplication — see OpenAPI YAML)

## Revisions
## Revision — SLICE-NN entries appended as slices progress
```

Removed (now lives only in YAML): auth scheme, rate limits, idempotency, retries, request/response shapes, error wire shapes, examples, route paths.

## Revisions

Revisions edit the YAML AND append `## Revision — SLICE-NN` to the markdown. The TS is regenerated; never hand-edited. Revisions that change a public operation must bump `info.version` in the YAML (semver).

## CI gate

`.github/workflows/test.yml` runs `npm run validate:contracts -- <yaml>` for every FEAT contract YAML committed in the repo (see Task 10).
