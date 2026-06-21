# Database Technology Selection

Technology selection matrix for relational, document, key-value, search, time-series, vector, graph, and serverless-relational engines; polyglot persistence patterns.

## Selection process

1. **Enumerate workloads** — list every access pattern: event ingestion, feature store, low-latency reads, full-text search, vector similarity, etc.
2. **Map workloads to categories** — each workload maps to one or more database categories below.
3. **Choose the simplest stack** — start with one DB (usually PostgreSQL) and add specialist engines only when a workload has measurable performance requirements the primary DB cannot meet.
4. **Document rationale** — record the trade-offs chosen in an ADR; future maintainers need to know why the stack is polyglot.

## Technology matrix

### Relational (ACID, complex relationships, reporting)

| Technology | Best for |
|---|---|
| PostgreSQL | Complex queries, JSONB support, rich extension ecosystem (pgvector, pg_trgm, TimescaleDB), preferred default |
| MySQL / MariaDB | High-insert OLTP, wide ecosystem, simpler operational profile |
| SQL Server | Enterprise features, Windows/Azure integration, Power BI / SSRS reporting |

### Document (flexible schema, rapid iteration, JSON documents)

| Technology | Best for |
|---|---|
| MongoDB | Rich aggregation pipeline, horizontal scaling, multi-document transactions |
| CouchDB | Offline-first, eventual consistency, HTTP-native API |
| Amazon DocumentDB | Managed MongoDB-compatible; AWS-native ops |

### Key-value / Wide-column (caching, session, real-time)

| Technology | Best for |
|---|---|
| Redis | In-memory data structures, pub/sub, Lua scripting, Streams (event log), clustering |
| Amazon DynamoDB | Managed, serverless, predictable latency at any scale; single-table design required |
| Apache Cassandra | Linear write scalability, multi-region active-active, wide-column model |

### Search (full-text, faceting, log analytics)

| Technology | Best for |
|---|---|
| Elasticsearch / OpenSearch | Full-text search, aggregations, log analytics, REST API |
| Apache Solr | Enterprise search, faceting, rich highlighting |
| Amazon CloudSearch | Managed, auto-scaling, simpler setup for smaller scale |

### Time-series (metrics, IoT, monitoring)

| Technology | Best for |
|---|---|
| TimescaleDB | PostgreSQL extension, SQL-compatible, continuous aggregates, compression |
| InfluxDB | Purpose-built time series, InfluxQL/Flux query languages |
| Amazon Timestream | Managed, serverless, built-in analytics |

### Vector (semantic search, RAG, embeddings, AI memory)

| Technology | Best for |
|---|---|
| pgvector | PostgreSQL extension — ANN search with zero extra infrastructure; preferred for apps already on Postgres |
| Pinecone | Managed vector DB; real-time upserts, metadata filtering, serverless |
| Qdrant | Open-source; payload filtering, on-premise or cloud |
| Weaviate | Hybrid BM25 + vector search, GraphQL API, multi-modal |

### Graph (fraud detection, social networks, recommendations)

| Technology | Best for |
|---|---|
| Neo4j | Mature Cypher query language, ACID, rich ecosystem |
| Amazon Neptune | Managed; Gremlin + SPARQL; AWS-native ops |
| ArangoDB | Multi-model (graph + document + key-value), AQL query language |

### Serverless-relational (branch-per-PR, edge, autoscale-to-zero)

| Technology | Best for |
|---|---|
| Neon | Serverless PostgreSQL, database branching, autoscale to zero; preferred for modern SaaS |
| PlanetScale | Serverless MySQL, schema branching, non-blocking migrations |
| Turso | SQLite at the edge, per-tenant databases, sub-millisecond latency |

## Polyglot persistence

Use multiple engines only when workloads have genuinely different requirements:

```
Write path:   PostgreSQL (ACID transactions, primary truth)
Cache:        Redis (TTL-based session cache, hot reads)
Search:       Elasticsearch (full-text + faceted search index)
Analytics:    InfluxDB / TimescaleDB (time-series metrics)
AI memory:    pgvector (semantic search over embeddings)
```

**Synchronization pattern:** Write to PostgreSQL first; publish domain events to a message bus (Kafka / SQS); downstream projectors update Redis, Elasticsearch, and time-series stores asynchronously.

**Consistency trade-off:** Polyglot stores are eventually consistent with the primary. Use the primary for read-your-writes scenarios; use projections for bulk reads and search.

## Decision anti-patterns

- Choosing MongoDB "because it's flexible" without identifying a schema-flexibility requirement.
- Running Redis as the primary data store without a persistence strategy (AOF/RDB).
- Over-sharding early — start with a single Postgres instance; scale when you have measured bottlenecks.
- Mixing OLTP and analytics in the same DB without read replicas or CQRS — analytics queries starve OLTP.
- Picking a managed vector DB before evaluating `pgvector` — for most apps, pgvector covers 80% of the use case at zero infra cost.
