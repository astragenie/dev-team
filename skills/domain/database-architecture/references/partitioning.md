# Partitioning and Scaling

Horizontal sharding, consistent hashing, read replica routing, event sourcing, and CQRS patterns.

## Horizontal sharding

Use when a single DB instance cannot handle write throughput or data volume after vertical scaling + read replicas are exhausted.

### Consistent hashing for customer data

```python
class ShardManager:
    def __init__(self, shard_config):
        self.shards = {sid: DatabaseConnection(cfg) for sid, cfg in shard_config.items()}

    def get_shard(self, entity_id: str) -> str:
        hash_value = hashlib.md5(str(entity_id).encode()).hexdigest()
        shard_number = int(hash_value[:8], 16) % len(self.shards)
        return f"shard_{shard_number}"

    async def get_customer_orders(self, customer_id: str):
        shard_db = self.shards[self.get_shard(customer_id)]
        return await shard_db.fetch_all(
            "SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC",
            customer_id
        )

    async def cross_shard_analytics(self, query, params):
        # Fan out in parallel; aggregate results
        tasks = [shard_db.fetch_all(query, params) for shard_db in self.shards.values()]
        shard_results = await asyncio.gather(*tasks)
        return [row for result in shard_results for row in result]
```

### Sharding decision criteria

| Concern | Recommendation |
|---|---|
| Shard key | Choose a high-cardinality key that co-locates related data (e.g., `customer_id`) |
| Cross-shard queries | Avoid where possible; use CQRS / read model for analytics that span shards |
| Resharding | Plan for power-of-two shard counts to enable doubling; consistent hashing minimizes data movement |
| Schema evolution | All shards must migrate in lock-step; automate with migration runner across all shards |

## Event sourcing

Store an immutable sequence of domain events; derive current state by replaying or via projections.

```python
# Event store: append-only, versioned events per aggregate stream
async def append_events(event_store, aggregate_id: str, events: list[dict]):
    await event_store.append_events(aggregate_id, events)

# Example event sequence for an order
events = [
    {"event_type": "order.initiated",   "version": 1, "data": {"customer_id": "...", "items": [...]}},
    {"event_type": "inventory.reserved","version": 2, "data": {"items": [...]}},
    {"event_type": "payment.processed", "version": 3, "data": {"amount": 99.99}},
    {"event_type": "order.confirmed",   "version": 4, "data": {"order_id": "..."}},
]
```

**When to use event sourcing:**
- Audit trail is a hard requirement (finance, healthcare, legal)
- Time-travel queries or state reconstruction needed
- Complex multi-step saga / compensation patterns required
- Event-driven microservices integration (publish to message bus from the event store)

**When NOT to use:**
- Simple CRUD with no audit requirement — adds complexity without value
- Reporting is the primary access pattern — use a separate read model / data warehouse

## CQRS (Command Query Responsibility Segregation)

Separate write model (commands, transactions) from read model (queries, projections):

- **Write side** — normalized, ACID-consistent, append-only event store or command tables.
- **Read side** — denormalized projection tables or read-optimized views, updated via event handlers.
- **Consistency** — read model is eventually consistent; acceptable for most UI reads; use write side for read-your-writes within a transaction.

## Partitioning (within a single DB)

PostgreSQL declarative partitioning for time-series or range-based tables:

```sql
-- Range partition by month for time-series data
CREATE TABLE events (
    id UUID NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    event_type TEXT NOT NULL
) PARTITION BY RANGE (created_at);

CREATE TABLE events_2026_01 PARTITION OF events
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE events_2026_02 PARTITION OF events
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- Automate future partition creation via pg_partman extension
```

**Partition key selection:** Use the column most frequently in WHERE filters (usually `created_at` for time-series, `tenant_id` for multi-tenant with many tenants per DB).

## Saga pattern for distributed transactions

Use when a transaction spans multiple services and ACID is not available:

1. **Choreography** — each service publishes an event; downstream services react. Simple, but hard to trace.
2. **Orchestration** — a saga coordinator issues commands; handles compensating transactions on failure. Preferred for complex flows.

Compensating transaction: for each step, define the undo action. If step 3 fails, execute undo-2, undo-1 in reverse order.
