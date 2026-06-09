---
name: api-architecture
tier: domain
description: API design patterns for REST and GraphQL — three-layer REST architecture (service/manager/resilience), GraphQL resolver pattern with DataLoader, versioning, security checklist, and requirements gathering protocol.
owner: hero-crew
last_reviewed: 2026-06-09
triggers: ["api design", "REST API", "GraphQL", "API contract", "OpenAPI", "api-architect", "circuit breaker", "resilience layer", "DataLoader", "GraphQL schema", "API versioning", "resolver", "federation", "Apollo Federation", "gRPC"]
---

## When to use

Consult when:
- Designing a new REST or GraphQL API from scratch
- Choosing between REST / GraphQL / gRPC for a new service
- Structuring a resilient REST client (circuit breaker, retry, bulkhead)
- Designing a GraphQL schema (SDL-first, federation, N+1 prevention)
- Reviewing API security coverage before shipping

## Requirements to gather before generating

Collect all mandatory items before producing code or contracts.

### Shared (REST and GraphQL)
- Coding language and framework **(mandatory)**
- API type: REST, GraphQL, or both **(mandatory)**
- Authentication scheme: OAuth 2.0, API key, mTLS, JWT, or none **(mandatory)**
- API name / domain context _(optional — mock derived from endpoint if omitted)_
- Test cases _(optional)_

### REST-specific
- API endpoint base URL **(mandatory)**
- DTOs for request and response _(optional — mock generated if omitted)_
- REST methods required: GET, GET-all, PUT, POST, DELETE _(at least one mandatory)_
- Resilience patterns: circuit breaker, bulkhead, throttling, backoff _(optional)_
- Versioning strategy: URL path (`/v1/`), header (`Accept-Version`), or query param _(optional)_

### GraphQL-specific
- Schema-design approach: SDL-first or code-first **(mandatory)**
- Operations needed: queries, mutations, subscriptions _(at least one mandatory)_
- Federation: monolithic schema or Apollo Federation subgraph _(optional)_
- Persisted queries: enabled or disabled _(optional)_
- Query depth and complexity limits _(optional — sensible defaults applied)_

## Architecture — three-layer pattern (REST)

```
Resilience layer  ←  wraps manager with circuit breaker / retry / bulkhead
    ↓                 (Resilience4j for Java/Kotlin, Polly for .NET, cockatiel for Node.js)
Manager layer     ←  abstraction for configuration and testability; calls service layer
    ↓
Service layer     ←  raw HTTP requests and responses
```

Group files by layer (`service/`, `manager/`, `resilience/`). Keep base URLs, timeouts, and credentials in environment variables — never hardcoded.

## Architecture — resolver pattern (GraphQL)

- Define schema in SDL or generate from code-first decorators.
- Organise resolvers by domain: Query, Mutation, Subscription, Type resolvers.
- **DataLoader** (or language-equivalent): batch and deduplicate all DB or service calls to eliminate N+1 queries.
- **Query depth limiting**: reject queries deeper than configured max (default ≤ 10).
- **Query complexity scoring**: reject queries above configured cost threshold.
- **Disable introspection in production** (`NODE_ENV === 'production'` or equivalent).
- **Apollo Federation**: expose subgraph schema with `@key`, `@external`, `@requires`, `@provides` directives where applicable.

## API versioning and lifecycle

| API type | Strategy |
|---|---|
| REST | Implement requested strategy (URL path / header / query param). Annotate deprecated endpoints with `Deprecation` response header + sunset date. |
| GraphQL | Use `@deprecated(reason: "...")` on deprecated fields and types. Never remove a field without at least one deprecation cycle. |

## Code quality rules

- Fully implement all layers — no stubs, no `// TODO`, no placeholder comments.
- Do not instruct the developer to "similarly implement other methods" — write every method.
- Favour code over prose: if expressible in code, write the code.
- Use `path.join()` or equivalent for cross-platform path handling.

## Security checklist (apply to every solution)

### Universal
- [ ] Enforce TLS for all outbound and inbound connections
- [ ] Validate and sanitize all input (reject unexpected fields, enforce type constraints)
- [ ] Apply rate limiting at the entry point
- [ ] Log security-relevant events (auth failures, rate-limit triggers) — never log secrets or PII
- [ ] Reference OWASP API Security Top 10 for threat coverage

### REST
- [ ] Implement chosen auth scheme (OAuth 2.0 Bearer, API key header, mTLS client cert, or JWT validation)
- [ ] Return `401 Unauthorized` for missing/invalid credentials; `403 Forbidden` for insufficient scope
- [ ] Set security headers: `Strict-Transport-Security`, `X-Content-Type-Options`, `X-Frame-Options`

### GraphQL
- [ ] Disable introspection in production
- [ ] Enforce query depth limiting (reject beyond configured max)
- [ ] Enforce query complexity scoring (reject above configured cost threshold)
- [ ] Authenticate at the context layer, not inside individual resolvers
- [ ] Validate enum values and scalar types with custom scalars where needed

## Done / Acceptance

API design is complete when:
- All mandatory requirements gathered before any code generated
- Three-layer architecture (REST) or resolver/DataLoader pattern (GraphQL) implemented — no stubs
- Security checklist fully checked
- Versioning strategy implemented with deprecation annotations where applicable
- No secrets or credentials hardcoded — all config in environment variables
- Input validation and rate limiting in place at entry point
