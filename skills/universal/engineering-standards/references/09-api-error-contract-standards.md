# API + Error Contract Standards

Combined API design + error handling. The two form one contract surface — the response shape AND the failure shape belong to the same contract. RFC 7807 ProblemDetails is the common pivot.

## Purpose

Maintain consistent, scalable, predictable APIs whose failures are understandable, observable, and recoverable.

---

## Part 1: API design

### Core principles

APIs must be:

- predictable
- observable
- versionable
- secure
- cancellation-aware

### API style

- REST for CRUD.
- Streaming endpoints for AI generation.
- Async workflows for long-running operations.
- RFC 7807 ProblemDetails for all errors.
- Versioned with an explicit backward-compatibility strategy.
- Support cancellation and pagination on appropriate endpoints.

### Endpoint naming

Use:

- Nouns.
- Plural collections.
- Stable semantics.

Examples:

- `/api/notebooks`
- `/api/sources`
- `/api/memories`

Avoid:

- Verbs in endpoints.
- Inconsistent casing.

### Versioning

Required:

- Explicit API versioning.
- Backward-compatibility strategy.

### Async workflow rules

Long-running operations must:

- Return job ids.
- Support cancellation.
- Expose progress.
- Support retries.

### Pagination rules

Required:

- Cursor pagination preferred.
- Deterministic ordering.

### Validation rules

All APIs must:

- Validate inputs.
- Sanitize uploads.
- Reject invalid states.

### AI endpoint rules

AI endpoints must expose:

- Grounding metadata.
- Citation metadata.
- Evaluation metadata where applicable.

### Security rules

APIs must:

- Validate authorization.
- Enforce notebook boundaries.
- Protect sensitive memory.

---

## Part 2: Error handling

### Core principle

Users (and on-call engineers) should understand:

- What failed.
- Why it failed.
- Whether retry is safe.

Errors must be actionable. Never expose secrets. Preserve correlation IDs. Prefer typed errors. Avoid generic messages.

### Forbidden behaviors

- Generic "Something went wrong".
- Swallowed exceptions.
- Leaking internal stack traces.
- Silent failures.

### Required error structure (RFC 7807 ProblemDetails)

Every error response must include:

- `code` — stable machine-readable error code.
- `message` — user-safe human-readable message.
- `correlation_id` — propagated from `X-Correlation-Id` / `traceparent`.
- `retry_after` or `retryable: boolean` — retry guidance.
- `detail` — actionable specifics (which field, which constraint).

`application/problem+json` content type.

### Logging rules

All important failures must log:

- Exception (type + message + stack).
- Context (operation, parameters scrubbed of PII).
- Notebook id.
- User id if safe (hashed if PII).
- Workflow state.

### AI workflow errors

AI failures must distinguish:

- Retrieval failure.
- Grounding failure.
- Provider failure.
- Evaluation failure.
- Parsing failure.

### Retry rules

Retry only:

- Transient network failures.
- Temporary provider failures.
- Retry-safe workflows (idempotent operations).

Avoid:

- Retry storms.
- Duplicate side effects.

### UX rules

Users must see:

- Useful errors.
- Recovery actions.
- Retry options.
- Preserved work state.

---

## Cross-reference

The fast path in `SKILL.md` carries the stable status-code semantics (400 / 401 / 403 / 404 / 409 / 422 / 429 / 5xx). Use this reference for depth on shape + retry guidance.
