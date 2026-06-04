# Schema Design

Guidance for entity-relationship modeling, normalization, constraints, and multi-tenant isolation.

## Core modeling steps

1. **Identify entities and relationships** — map business nouns to tables; map verbs to FK relationships or join tables.
2. **Choose a normalization level** — 3NF is the default; denormalize only when a specific query-performance requirement justifies it (measure first).
3. **Embed business rules as constraints** — CHECK, UNIQUE, NOT NULL, and FOREIGN KEY constraints catch errors at the DB layer where they cannot be bypassed by application bugs.
4. **Use UUIDs or sequential IDs deliberately** — UUIDs (`gen_random_uuid()`) for distributed systems and audit trails; `BIGSERIAL` for high-insert workloads where index locality matters.
5. **Snapshot mutable references at write time** — e.g., store `product_name` + `product_sku` on the order line item, not just the FK, to survive catalog changes.

## Constraint patterns

```sql
-- Conditional unique: only one default per type per customer
UNIQUE(customer_id, address_type, is_default) WHERE is_default = true

-- Enum state machine
CREATE TYPE order_status AS ENUM (
    'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'
);

-- Derived total constraint
CONSTRAINT valid_total CHECK (total_amount = subtotal + tax_amount + shipping_amount)

-- Prevent self-reference in hierarchical tables
CONSTRAINT no_self_reference CHECK (id != parent_id)
```

## Multi-tenant isolation patterns

| Strategy | Isolation | Cost | Complexity | Best For |
|---|---|---|---|---|
| Row-Level Security (RLS) | Medium | Low | Low | SaaS with uniform schema, cost-sensitive |
| Schema-per-tenant | High | Medium | Medium | Regulated industries, customizable schemas |
| Database-per-tenant | Highest | High | High | Large enterprise, strict data residency |

### PostgreSQL RLS (recommended default for SaaS)

```sql
-- Enable RLS on tenant tables
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Set session variable before each query: SET LOCAL app.current_tenant = $1
CREATE POLICY tenant_isolation ON projects
    USING (tenant_id = current_setting('app.current_tenant')::uuid);

CREATE POLICY tenant_isolation ON tasks
    USING (tenant_id = current_setting('app.current_tenant')::uuid);

-- Application role (enforces RLS); admin role (BYPASSRLS for cross-tenant ops)
CREATE ROLE app_user NOLOGIN;
GRANT SELECT, INSERT, UPDATE, DELETE ON projects, tasks TO app_user;
CREATE ROLE app_admin BYPASSRLS;
```

### Schema-per-tenant

```sql
-- Provision a new tenant schema
CREATE SCHEMA tenant_abc123;
CREATE TABLE tenant_abc123.projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Route queries: SET search_path TO tenant_abc123, public;
```

## Microservices data boundaries

- **Database-per-service** is the default for microservices; shared databases create hidden coupling.
- Use event publishing to propagate cross-service state changes (see `references/partitioning.md` for event sourcing).
- Store customer/product snapshots in downstream service tables; do not query across service DB boundaries.

## Anti-patterns

- Storing JSON blobs to avoid schema evolution — use migrations instead.
- Over-normalizing hot read paths — profile before splitting.
- Using strings for numeric money values — use `DECIMAL(19,4)` or `BIGINT` (cents).
- Nullable FKs where the relationship is truly optional but semantically required — prefer nullable + partial index.
- Missing `updated_at` on any mutable table — makes CDC, replication, and debugging harder.
