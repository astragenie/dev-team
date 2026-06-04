---
name: api-documentation
tier: workflow
description: API documentation authoring covering OpenAPI 3.1 specs, SDK reference guides, authentication docs, error documentation, versioning guides, and interactive portal setup.
source: aitmpl/documentation/api-documenter
source_version: 2026-06-04
last_reviewed: 2026-06-04
owner: hero-crew
triggers: ["OpenAPI", "API docs", "swagger", "REST API", "GraphQL", "gRPC", "webhook", "SDK reference", "api-documenter", "endpoint documentation", "authentication guide", "migration guide", "breaking changes", "deprecation", "rate limit", "pagination docs"]
---

# API Documentation

Guidance for authoring world-class API documentation: OpenAPI 3.1 specs, SDK references,
authentication guides, error documentation, versioning, and interactive portal setup.

## When to use

Consult this skill when:
- Writing or improving OpenAPI 3.1 specification files
- Documenting REST, GraphQL, WebSocket, gRPC, or Webhook APIs
- Creating authentication guides (OAuth 2.0, API key, JWT, SSO)
- Authoring SDK reference docs or integration quick-start guides
- Documenting error codes, resolution steps, and retry strategies
- Writing versioning / deprecation notices and migration guides
- Setting up interactive documentation portals (try-it-out, code generation)
- Automating documentation via CI/CD integration

## Core principles

- **Accuracy first** — ground all documentation in the actual API code and specs; never
  speculate about endpoint behavior.
- **Developer experience** — documentation exists to reduce integration friction and
  support burden, not to satisfy a checklist.
- **100% endpoint coverage** — every endpoint, parameter, request body, response shape,
  and error code documented.
- **Real examples** — provide working code samples for every common use case; cover
  error paths and edge cases, not just the happy path.
- **Progressive disclosure** — quick start guide first, full reference behind it.
- **Consistent naming** — align terminology with the codebase and product; naming
  mismatches are a leading cause of integration errors.

## OpenAPI 3.1 checklist

- [ ] Schema definitions complete (request bodies + response objects)
- [ ] All endpoints documented with summary + description
- [ ] All parameters (path, query, header, cookie) described with type and example
- [ ] Error responses documented: status codes, error schema, resolution steps
- [ ] Security schemes defined and applied to all protected endpoints
- [ ] Reusable components extracted to `#/components/schemas` (no inline duplication)
- [ ] Example values provided for all request and response schemas
- [ ] `operationId` set on every endpoint (used by code generators)

## Documentation types and coverage

| Type | Required sections |
|---|---|
| REST API | Endpoints, parameters, request/response examples, error codes, authentication |
| GraphQL | Type definitions, query examples, mutation examples, subscription patterns, auth |
| WebSocket | Connection lifecycle, message schema, event types, reconnection handling |
| Webhooks | Event catalog, payload schema, signature verification, retry behavior |
| SDK reference | Installation, configuration, method signatures, return types, error handling, async patterns |

## Authentication documentation

For each auth scheme:
- OAuth 2.0: document all supported flows (authorization code, client credentials, device);
  include token endpoint URLs, required scopes, and token refresh.
- API key: document header name, parameter name, or cookie; show example curl command.
- JWT: document token structure, expiry, signing algorithm; show validation example.
- SSO / SAML: document IdP configuration steps, attribute mapping, redirect URIs.

Always include a security best practices section: credential rotation, scope minimization,
token storage, environment separation.

## Error documentation

For each error code:
- HTTP status code and custom error code (if any)
- Human-readable message
- Common causes
- Resolution steps
- Whether the error is retryable and recommended backoff strategy
- Example error response body

```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests. Retry after the time indicated in the Retry-After header.",
  "retryable": true,
  "retry_after": 60
}
```

## Versioning and deprecation

- Document all breaking changes with before/after endpoint comparisons.
- Provide a migration guide for every breaking change; include code examples.
- Set a deprecation timeline with specific sunset dates.
- Emit `Deprecation` and `Sunset` HTTP response headers on deprecated endpoints.
- Maintain a compatibility matrix for overlapping active versions.

## Integration guides structure

1. Quick start (< 5 minutes to first successful API call)
2. Authentication setup
3. Common use case walkthroughs (3–5 scenarios)
4. Rate limit handling and backoff
5. Error handling patterns
6. Webhook setup and verification
7. Testing and sandbox environment
8. Production readiness checklist

## Done / Acceptance

API documentation is ready when:
- OpenAPI 3.1 file passes `openapi-validator` lint with zero errors
- All endpoints documented with examples for success and primary error cases
- Authentication flow can be followed without consulting the source code
- A developer unfamiliar with the API can complete the quick start in under 5 minutes
- All breaking changes have migration guides with code examples
- Error codes have resolution steps (not just descriptions)
- Documentation is versioned alongside the API code in the same repository
