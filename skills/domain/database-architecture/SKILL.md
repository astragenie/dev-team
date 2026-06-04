---
name: database-architecture
tier: domain
description: Database design, data modeling, schema evolution, technology selection, partitioning, multi-tenancy, and polyglot persistence patterns for production systems.
source: aitmpl/database/database-architect
source_version: 2026-06-04
last_reviewed: 2026-06-04
owner: hero-crew
triggers: ["schema", "migration", "database", "postgres", "mysql", "mongodb", "redis", "data model", "DDL", "index", "sharding", "partitioning", "multi-tenant", "ORM", "prisma", "sqlalchemy", "event sourcing", "CQRS", "polyglot persistence", "db choice", "*.sql", "*.prisma"]
---

# Database Architecture

Design and evolution guidance for production database systems: schema, indexing, migration,
technology selection, multi-tenancy, and scaling strategies.

## When to use

Consult this skill when:
- Designing a greenfield schema or evolving an existing one
- Planning a database migration (monolith decomposition, live cutover, zero-downtime)
- Selecting a database technology (relational, document, key-value, vector, graph, time-series)
- Designing multi-tenant isolation (RLS, schema-per-tenant, database-per-tenant)
- Choosing a partitioning or sharding strategy for large data sets
- Applying CQRS, event sourcing, or saga patterns
- Tuning query performance or diagnosing slow queries
- Modeling microservices data boundaries (database-per-service pattern)

## Core principles

- **Domain alignment** — database boundaries should match business domain boundaries (DDD).
- **Access-pattern first** — gather read/write ratio, query shapes, latency SLAs, and data volume before choosing a schema or technology.
- **ACID vs eventual** — choose consistency models based on business requirements, not convenience.
- **Scalability path** — plan for growth from day one; start simple and expand incrementally.
- **Migrations as code** — every schema change has a versioned, reviewed, rollback-capable migration script.
- **Operational simplicity** — prefer managed services and standard patterns over bespoke infrastructure.
- **Cost-appropriate storage** — right-size engines; avoid over-engineering a cache into a primary store.
- **Security by design** — PII classification, encryption at rest/in transit, and RLS where tenant isolation is needed.

## Subtopics

Detailed guidance lives in the `references/` directory. Load a reference file when the work matches its scope:

| Reference | Load when |
|---|---|
| [references/schema-design.md](references/schema-design.md) | Greenfield schema design, ER modeling, normalization, constraints, multi-tenant isolation patterns |
| [references/indexing-and-performance.md](references/indexing-and-performance.md) | Index strategy, query plan analysis, read replicas, connection pool sizing, performance monitoring queries |
| [references/migrations.md](references/migrations.md) | Schema migration frameworks, zero-downtime techniques, rollback scripts, monolith decomposition |
| [references/partitioning.md](references/partitioning.md) | Horizontal sharding, consistent hashing, read replica routing, event sourcing + CQRS patterns |
| [references/db-choice.md](references/db-choice.md) | Technology selection matrix (relational, document, key-value, search, time-series, vector, graph, serverless-relational), polyglot persistence |

Each reference file is self-contained — no prior context from this SKILL.md is required to use it.

## Cross-references

- General architecture principles → `skills/domain/architecture-advisory/`
- Cloud infra for database provisioning (managed RDS, VPC peering, connection pooling) → `skills/domain/cloud-architecture/`
- PostgreSQL-specific query tuning, EXPLAIN analysis, replication → delegate to `agents/3rdparty/database-architect.md` (postgres-pro handoff)
- Security controls (PII, encryption, audit logging, SOC2/GDPR) → co-cite `skills/domain/security-advisory/`

## Done / Acceptance

A database design or migration is ready when:
- Schema changes are versioned in migration files with up + down scripts
- Indexes cover all query patterns identified in access-pattern discovery
- Multi-tenant isolation mode is explicitly chosen and documented
- Technology selection is justified against the access-pattern + SLA matrix
- Performance baseline is established (query plan reviewed, slow-query log enabled)
- Rollback procedure is tested or documented for every migration step
- PII columns are identified and encryption / masking controls are in place
