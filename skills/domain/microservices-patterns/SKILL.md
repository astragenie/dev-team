---
name: microservices-patterns
tier: domain
description: Microservices design patterns — circuit breaker, saga, service discovery, distributed tracing, message queue integration. Use when a FEAT involves inter-service communication, async messaging, or distributed transaction design.
owner: sergeymilashico
last_reviewed: 2026-06-09
triggers: ["microservice", "kafka", "rabbitmq", "service mesh", "saga", "circuit breaker", "dead letter", "distributed tracing"]
---

# Microservices Patterns

## When to Use

Load when the slice involves: introducing a new service, adding inter-service calls, wiring message queues, or designing distributed transaction flows.

## Service Communication

### Synchronous (request/response)
- **REST**: default for simple CRUD operations between services
- **gRPC**: prefer when latency matters and both sides are owned (binary, streaming, strongly typed)
- **GraphQL federation**: only when consumer-driven shape flexibility is needed across service boundaries

### Asynchronous (event/message)
- **Kafka**: high-throughput event streaming, replay, multi-consumer fan-out
- **RabbitMQ / Azure Service Bus**: task queues, delayed processing, priority queues

Rule: **prefer async for cross-service state changes** — synchronous chains create coupling and cascading failures.

## Circuit Breaker

Wrap every synchronous outbound call to an external service:

```
States: Closed → Open → Half-Open
Closed:    requests pass through; failure count tracks
Open:      fail fast; no outbound calls; wait cooldown
Half-Open: probe with limited requests; success → Closed; failure → Open
```

**Thresholds to configure:**
- `failureThreshold` — e.g., 5 failures in 10 seconds
- `timeout` — e.g., 30 seconds in Open before probing
- `halfOpenRequests` — e.g., 3 probe requests

Libraries: Polly (.NET), Resilience4j (JVM), opossum (Node).

## Retry + Timeout

- Exponential backoff with jitter on transient errors
- Always set a hard timeout per outbound call (not just retries)
- Do NOT retry non-idempotent writes without idempotency key support

## Saga Pattern (Distributed Transactions)

Use when a business operation spans multiple services with no shared DB.

### Choreography saga
- Each service publishes an event on success; downstream services react
- Compensation: each service also listens for a `*_failed` event and reverses its local change
- Suitable for simple flows (≤ 3 services, no complex rollback sequencing)

### Orchestration saga
- A dedicated saga orchestrator sends commands to each service and waits for replies
- Orchestrator coordinates rollback on failure
- Prefer for complex flows (> 3 services, strict ordering, complex compensation logic)

**Design rule**: every saga step must have a defined compensation action. Document both the happy path and the compensation path before implementation.

## Message Queue Integration

### Producer contract
- Serialize messages to a versioned schema (Avro, Protobuf, or JSON Schema)
- Set a `messageId` (UUID) on every message for deduplication
- Set `correlationId` for request tracing across services

### Consumer contract
- **Idempotency**: consumers MUST handle duplicate delivery — use `messageId` to deduplicate
- **At-least-once delivery**: assume messages can be delivered more than once
- **Dead Letter Queue (DLQ)**: route poison messages after N retries; alert on DLQ depth
- **Back-pressure**: consumer should apply rate limiting; never unbounded consumption

### Batch processing
- Use batch consumers for high-throughput write paths
- Flush on size (e.g., 100 msgs) OR timeout (e.g., 5s), whichever comes first
- Track batch offset commit separately from message processing to avoid data loss

### Message replay
- Store event log with retention that allows replay (Kafka: topic retention; SB: max delivery count)
- Document replay procedure in runbook

## Service Discovery

- Container environments (Kubernetes): DNS-based discovery via Service objects
- Non-container: Consul or environment-injected base URLs
- Never hard-code service hostnames — use config or service registry

## Distributed Tracing

Every service participating in a cross-service call MUST:
1. Propagate `traceparent` / `tracestate` headers (W3C Trace Context)
2. Create a child span for each inbound and outbound call
3. Tag spans with: `service.name`, `http.method`, `http.status_code`, `db.statement` (truncated)

Library: OpenTelemetry SDK — vendor-agnostic, export to Jaeger / Zipkin / OTLP.

Structured logs MUST include `traceId` and `spanId` so logs correlate with traces.

## API Gateway Integration

- Rate limiting and auth at the gateway layer, not in individual services
- Services trust the gateway's identity headers; validate them — never re-authenticate
- Version routing (v1 / v2) at the gateway; services need not know the version

## Done criteria

- Every outbound sync call is wrapped in a circuit breaker with configured thresholds
- All message consumers are idempotent and handle duplicate delivery
- DLQ configured and alert threshold documented per consumer
- Saga compensation actions defined and documented for every step
- Distributed tracing headers propagated on all inter-service calls
- No hard-coded service hostnames; environment or service discovery used
- Message schema versioned or contract-tested

