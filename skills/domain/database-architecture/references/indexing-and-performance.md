# Indexing and Performance

Strategy for index design, query plan analysis, read replicas, and performance monitoring.

## Index strategy

- **Index every FK column** used in JOIN or WHERE clauses — missing FK indexes are the most common slow-query root cause.
- **Partial indexes** reduce index size for sparse conditions: `CREATE INDEX idx_active ON users(email) WHERE is_active = true`.
- **Composite index column order** — most selective column first; match the WHERE + ORDER BY column sequence.
- **Covering indexes** — include all SELECT columns to avoid heap fetches on hot read paths.
- **Full-text search** — use `pg_trgm` + `GIN` index or dedicated search engine (Elasticsearch) rather than `LIKE '%term%'`.
- **Vector similarity** — use `pgvector` with `ivfflat` or `hnsw` index for ANN search; tune `lists` / `ef_construction` parameters.

## Query plan analysis (PostgreSQL)

```sql
-- Use EXPLAIN ANALYZE for actual execution stats
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT) SELECT ...;

-- Key signals to watch:
-- Seq Scan on large table → missing index
-- Nested Loop with large row estimates → statistics stale, run ANALYZE
-- Hash Join vs Merge Join → check work_mem setting
-- Bitmap Heap Scan → index exists but selectivity is low, consider partial index

-- Refresh statistics after bulk loads
ANALYZE table_name;
VACUUM ANALYZE table_name;
```

## Read replica routing

```sql
-- PostgreSQL streaming replication (master postgresql.conf)
wal_level = replica
max_wal_senders = 3
wal_keep_size = 512  -- MB
archive_mode = on
archive_command = 'cp %p /var/lib/postgresql/archive/%f'

-- Replication user (use secrets manager for password)
CREATE USER replicator REPLICATION LOGIN CONNECTION LIMIT 3
    ENCRYPTED PASSWORD '${REPLICATION_PASSWORD}';
```

Application-level routing pattern:
- Write traffic → primary
- Read traffic (reports, dashboards) → replica with `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY`
- Session-consistent reads (read-your-writes) → primary with replica fallback after replication lag < threshold

## Connection pool sizing

- PgBouncer in **transaction mode** is the standard for high-concurrency workloads (reduces connection count 10–50×).
- Pool size formula: `(num_cores * 2) + effective_spindle_count` — rarely exceeds 20–30 for Postgres.
- Detect pool exhaustion: `SELECT count(*) FROM pg_stat_activity WHERE state = 'idle'` — a high count signals pool misconfiguration.

## Performance monitoring queries

```sql
-- Top slow queries (requires pg_stat_statements)
SELECT query, calls, total_exec_time, mean_exec_time, rows,
       100.0 * shared_blks_hit / NULLIF(shared_blks_hit + shared_blks_read, 0) AS hit_pct
FROM pg_stat_statements
ORDER BY total_exec_time DESC LIMIT 20;

-- Unused indexes (candidates for removal)
SELECT schemaname, tablename, indexname, idx_scan,
       CASE WHEN idx_scan = 0 THEN 'Unused' WHEN idx_scan < 10 THEN 'Low' ELSE 'Active' END AS status
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;

-- Lock contention
SELECT pg_class.relname, pg_locks.mode, COUNT(*) AS lock_count
FROM pg_locks JOIN pg_class ON pg_locks.relation = pg_class.oid
WHERE pg_locks.granted = true
GROUP BY pg_class.relname, pg_locks.mode ORDER BY lock_count DESC;

-- Active connections by state
SELECT state, COUNT(*) AS count,
       AVG(EXTRACT(EPOCH FROM (now() - state_change))) AS avg_duration_sec
FROM pg_stat_activity WHERE state IS NOT NULL GROUP BY state;
```

## Anti-patterns

- Adding an index for every column — indexes slow INSERT/UPDATE/DELETE; index selectively.
- `SELECT *` on large tables in application code — fetch only needed columns.
- Implicit type coercion in WHERE clause (`WHERE id = '123'` on `INTEGER id`) — prevents index use.
- Long-running transactions holding row locks — keep transactions short; defer non-transactional work.
- N+1 queries from ORM lazy loading — use eager loading / JOIN or batch loading.
