# Observability Standards

What to emit, what to name it, what to never log. Reuse before creating new.

## Stack

- **OpenTelemetry** for spans + metrics.
- **Structured logs** (`{key: value, ...}` JSON, NOT printf).
- **Langfuse** for LLM call paths (in addition to OTel spans).

## Span naming

- `verb.noun` (lowercase, dots): `http.request`, `db.query`, `llm.dispatch`, `queue.publish`, `cache.lookup`.
- Use the verb the operation EXECUTES, not the high-level intent.
- Same op same name across services — never mix `db.query` and `database.select` for the same concept.

## Required fields per span

| Field | Source | Why |
|---|---|---|
| `operation` | span name | What ran |
| `duration_ms` | auto | How long |
| `status` | `ok` / `error` | Outcome class |
| `error.type` | only on error | What failed |
| `tenant_id` | request context | Multi-tenant correlation |
| `correlation_id` | `X-Correlation-Id` / `traceparent` | Cross-service link |

## Structured log shape (per request)

```json
{
  "timestamp": "<ISO 8601>",
  "level": "info|warn|error",
  "message": "<human-readable>",
  "request_id": "<from header or generated>",
  "correlation_id": "<from traceparent>",
  "user_id": "<hashed if PII>",
  "tenant_id": "<id>",
  "method": "GET|POST|...",
  "path": "/api/...",
  "status": 200,
  "duration_ms": 42,
  "outcome": "success|client_error|server_error"
}
```

## Metrics

- **Counters** for outcome class: `requests_total{path, method, status_class}`.
- **Histograms** for latency: `request_duration_seconds{path, method}` with sensible buckets (1ms, 10ms, 100ms, 1s, 10s).
- **Gauges** for in-flight + queue depth.
- Cardinality discipline — never label by user_id, request_id, or correlation_id (high cardinality kills the backend).

## Correlation id propagation

- Read `X-Correlation-Id` (or `traceparent`) on every inbound request.
- Generate at the edge if missing.
- Forward on every outbound HTTP / queue / LLM call.
- Include in every span + every log line.

## LLM trace fields (Langfuse + OTel)

- Model id (`anthropic/claude-opus-4-7`).
- Input + output token counts.
- Latency.
- Outcome (success / refusal / parse error / timeout).
- Prompt cache hit ratio (when available).
- Cost in cents (when known).

## Health endpoints (new services)

- `/health` — liveness (process alive).
- `/ready` — readiness (deps reachable).
- `/metrics` — Prometheus / OTel scrape endpoint.

All three exercised by smoke test.

## What NOT to log

- Raw request bodies on auth / payment / PII endpoints.
- Authorization headers, API keys, tokens.
- Passwords, even hashed (mask before serialization).
- Full PII — hash + truncate or omit.
- Secrets accidentally captured in stack traces (scrub before emit).

## Reuse hierarchy

1. Reuse existing telemetry — annotate spans, add labels to existing metrics.
2. Extend existing spans before forking new.
3. Add a label to an existing metric before creating a new metric.
4. Create new telemetry only when no existing surface carries the signal.

New telemetry without justification = telemetry explosion → on-call noise.

## Domain metrics (AI / runner workloads)

Where applicable, track:

- Retrieval latency + recall.
- Generation latency.
- Ingestion failures.
- Evaluation run outcomes.
- Memory write throughput.
