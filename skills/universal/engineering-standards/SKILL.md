---
name: engineering-standards
prompt_id: engineering-standards
version: 1.4.1
tier: universal
model_pinned: sonnet
description: Engineering-standards INDEX + fast-path checklists. Routes to vendored references (definition-of-done, code quality, minimal change, testing, API design, error handling, observability, DevOps deployment). Carries inline fast-path checklists for common cases (new endpoint, new error path, deployment-impacting change) so builders don't load 4 reference files for a routine slice. Vendored from kb/08-engineering/ for portability.
owner: astragenie
last_reviewed: 2026-06-21
triggers: ["definition of done", "code quality", "minimal change", "testing standards", "api design", "error handling", "observability", "devops", "deployment standards", "production readiness"]
---

# Engineering Standards — index + fast paths

Thin router over the vendored engineering bar (`references/`). For routine work, consult the fast-path checklist below. Load reference files only when the slice needs depth on one specific concern.

## Trigger

Load when the slice introduces or changes:

- Public behavior (new endpoint, CLI subcommand, exported function, artifact kind)
- Error handling (how errors are emitted, propagated, or surfaced)
- Observability (spans, metrics, structured logs)
- API shape (route, request/response contract, status codes)
- Testing strategy (new test layer, deferred test, coverage commitment)
- Deployment impact (env vars, migrations, infra wiring, release gates)

Skip for: typos, comment edits, docs-only changes, mechanical renames, formatting-only commits. Standards apply to product code, not chore commits.

## Fast path

Cover these inline before reaching for a reference file. Reference files are for depth on a specific concern, not lookup for every slice.

### New endpoint / handler

- RFC 7807 ProblemDetails on errors (`application/problem+json`); no raw stack traces.
- Stable status codes: 400 bad request, 401 auth, 403 policy, 404 resource, 409 conflict, 422 semantic, 429 rate-limited, 5xx server.
- Pagination on lists (page/pageSize + total, OR cursor + next_cursor).
- Input validation at the boundary (model binding + validator) before service call.
- Scoped tests (golden path + edge cases per `references/08-testing-standards.md`).
- OTel span + structured log per request (`{request_id, user_id_hashed, method, path, status, duration_ms, outcome}`).
- No secrets or PII in logs; mask before serialization.

### New error path

- Decide throw vs typed Result per `references/09-api-error-contract-standards.md`.
- Every throw → span event + structured log; never silent.
- Caller contract documented (which exceptions / which Result variants).

### New UI surface (component / page / form)

- Loading, error, empty, and success states explicitly handled — never a blank screen on async work.
- Accessibility impact assessed (focus order, ARIA roles, label association, color contrast, keyboard reachability).
- Analytics / telemetry events follow the existing pattern; reuse before creating a new event name.
- No hardcoded user-facing strings when the project uses i18n / localization.
- Component tests when behavior (not just markup) changes.
- No secrets / tokens / PII in client-side logs or telemetry payloads.

### New background job / workflow / agent execution

- Idempotent (same input → same output; safe to retry).
- Retry-safe with bounded backoff; classify transient vs permanent failure before retry.
- Observable: OTel span on each step + structured log + outcome counter.
- Bounded timeout on every external call (DB, HTTP, queue, LLM); no infinite-wait.
- Durable state outside process memory (DB / queue / blob); resumable from last checkpoint.
- Idempotency key on every outbound side effect (email, payment, webhook, LLM dispatch).

### Deployment-impacting change

- Migrations safe (expand-contract, reversible, idempotent backfill).
- Env vars + secrets registered in deployment guidance.
- Health endpoints (`/health`, `/ready`, `/metrics`) exercised by smoke test for new services.
- Release gate per `references/19-devops-deployment-standards.md`.

If the fast path doesn't answer the question, route to a reference file.

## Reference router

Read the specific reference for the concern. Don't load all 6 at once.

| Concern | Reference file |
|---|---|
| Is this slice "done"? Does it satisfy the launch bar? | `references/05-definition-of-done.md` |
| Should I refactor this opportunistically? How big is too big? Readability + minimal-change discipline. | `references/06-change-quality-standards.md` |
| What tests do I owe for net-new behavior? Unit vs integration vs e2e? | `references/08-testing-standards.md` |
| API contract design (REST shape, pagination, versioning) + error propagation + RFC 7807 shape | `references/09-api-error-contract-standards.md` |
| What spans / metrics / structured logs does this endpoint need? | `references/11-observability-standards.md` |
| Deployment + DevOps gates the change must satisfy | `references/19-devops-deployment-standards.md` |

## What this skill does NOT do

- Does NOT replace `root-cause-discipline` (band-aid refusal). Load both when both apply.
- Does NOT carry stack-specific recipes — those live in `skills/domain/typescript-pro/`, `skills/domain/dotnet/*`, etc.
- Does NOT carry plugin-internals guidance — `plugin-dev:*` skills own that.

## Done / Acceptance

You've consulted this skill correctly when:

- The fast path covered the routine concerns inline (no reference file load needed for a routine slice).
- A reference file was loaded only when the slice needed depth on that one concern.
- Standards influenced the diff (visible in code shape — RFC 7807 errors, paginated lists, span on new endpoint, etc.).
- Mention an applied standard in your Risks/Next only when it materially affects review or follow-up (e.g. `Risks: applied minimal-change policy; full refactor deferred`). Routine application doesn't need narration.

## Maintenance

Maintainer / drift / sync notes live in `skills/universal/engineering-standards/README.md`. Agents do not need them.
