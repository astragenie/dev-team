---
name: openapi-authoring
tier: domain
description: Quality bar for OpenAPI 3.1 contract artifacts emitted by the architect agent. Defines mandatory sections, custom extensions, and example payload discipline.
owner: hero-crew
last_reviewed: 2026-06-06
triggers: ["architect emits <FEAT>-contracts.openapi.yaml", "architect revises an existing contracts.openapi.yaml", "OpenAPI 3.1 contract authoring"]
---

# OpenAPI 3.1 authoring (architect skill)

## When to Use

You are the `crew:architect` agent producing a FEAT contract artifact. Invoke this skill whenever you write or revise `.claude/artifacts/crew/designs/<FEAT-ID>-contracts.openapi.yaml`.

## Mandatory shape

1. `openapi: 3.1.0` at the top. No 3.0.x — JSON Schema 2020-12 alignment matters for codegen.
2. `info.title`, `info.version` set. Bump `info.version` on every public-operation change (semver).
3. `components.securitySchemes` defines every auth flow the FEAT uses (bearer, OAuth scopes, API key). Every operation declares its `security` (use `[]` for explicitly anonymous endpoints).
4. Every operation has a unique, stable `operationId` (camelCase, verb-leading). This is the codegen symbol on both FE and BE sides.
5. Every operation has at least one example per declared response status code. Examples are real payloads — UUIDs, ISO timestamps, realistic field values. Placeholder `"foo": "bar"` payloads are forbidden — MSW handlers and the integrator agent consume these examples directly.
6. Every operation declares all error response codes it can return. "Catch-all 500" is not acceptable.

## Custom extensions

Use these `x-*` extensions for behavior OpenAPI can't express natively:

- `x-ratelimit: { window: <iso-duration>, limit: <int> }` — per-operation rate limit
- `x-idempotent: true | false | "idempotency-key-header"` — idempotency contract
- `x-retry: { max: <int>, backoff: "exponential" | "linear" }` — client retry guidance

Generated code MAY ignore these (codegen tooling doesn't always honor them); they are guidance for builders and reviewers.

## Done when

- `redocly lint --extends recommended` exits 0 against the YAML
- `node ./scripts/validate-contracts.mjs <yaml>` exits 0
- Every response code in every operation has an `examples` entry
- The companion `<FEAT-ID>-contracts.md` carries Decision rationale + Data Contracts + Revisions sections only — no wire-type duplication
