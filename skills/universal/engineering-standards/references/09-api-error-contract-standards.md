# API + Error Contract Standards

The shape an API returns AND the shape it fails with belong to the same contract surface. RFC 7807 ProblemDetails is the pivot.

## Purpose

Predictable, observable, versionable, secure APIs whose failures are understandable + recoverable.

## API shape

- REST for CRUD; streaming for AI generation; async workflows for long-running operations.
- `application/json` for normal responses; `application/problem+json` for errors.
- Endpoint naming: plural nouns + stable semantics (`/api/notebooks`, `/api/sources`). No verbs in paths. Consistent casing.
- AI endpoints expose grounding / citation / evaluation metadata where applicable.

## Versioning

- Explicit API versioning (URL or header — pick one per service).
- Backward-compatible evolution: additive only, never repurpose a field.
- Deprecate via `Deprecation` + `Sunset` headers + minor version bump.
- Breaking change = new route or new version.

## Pagination

- Cursor pagination preferred (`?cursor=` + `next_cursor`); page/pageSize acceptable for small bounded sets.
- Deterministic ordering — never rely on insertion order without an explicit `ORDER BY`.
- Total count optional (expensive on large sets) — document the choice per endpoint.

## Validation

- Validate inputs at the boundary (model binding + validator); reject before service-layer call.
- Sanitize uploads (size cap, MIME check, content scan where required).
- Reject invalid states explicitly — never silently coerce.

## Async workflows

Long-running operations:

- Return a job id.
- Support cancellation (DELETE on the job).
- Expose progress (poll endpoint or stream).
- Support retries (idempotency key on submit).

## Security

- Validate authorization on every endpoint.
- Enforce tenant / notebook / scope boundaries — cross-tenant leakage = security defect.
- Protect sensitive memory; mask PII in responses unless the contract requires it.

## ProblemDetails (RFC 7807) — required error shape

Every error response includes:

| Field | Purpose |
|---|---|
| `code` | Stable machine-readable error code |
| `message` | User-safe human-readable message |
| `correlation_id` | Propagated from `X-Correlation-Id` / `traceparent` |
| `retryable` (bool) or `retry_after` (secs) | Retry guidance |
| `detail` | Actionable specifics (which field, which constraint) |

## Status code semantics

`400` bad request · `401` auth · `403` policy · `404` resource · `409` conflict · `422` semantic · `429` rate-limited · `5xx` server.

## Retry semantics

Retry only:

- Transient network failures (`connection reset`, `timeout`).
- `429`, `5xx` (except `501`, `505`).
- Idempotent operations only.

Never retry: `400` / `401` / `403` / `404` / `409` / non-idempotent writes without an idempotency key.

Bounded backoff; classify transient vs permanent before retry.

## Logging on failure

- Exception type + message + scrubbed stack.
- Operation + parameters (PII masked).
- Tenant / user id (hashed if PII).
- Workflow state.

## Anti-patterns

- Generic "Something went wrong" responses.
- Swallowed exceptions (silent `catch { }`).
- Leaking internal stack traces to the caller.
- Repurposing a field's meaning across versions.
- Retry storms (no backoff, no jitter, no cap).
- Duplicate side effects on retry (no idempotency key).

## AI workflow errors

Distinguish + log separately:

- Retrieval failure.
- Grounding failure.
- Provider failure.
- Evaluation failure.
- Parsing failure.

## UX

Users see useful errors, recovery actions, retry options, and preserved work state — never raw stack traces.

## Cross-reference

`SKILL.md` fast path carries the status-code mnemonic + RFC 7807 requirement. This file is the depth.
