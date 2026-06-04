# SQL code-review checklist

Extracted from `agents/3rdparty/code-reviewer.md`.

## Unbounded mutations

Flag any `UPDATE` or `DELETE` statement missing a `WHERE` clause. An unguarded mutation can modify or destroy every row in the table.

**Fix:** Always require a `WHERE` clause. Add a linter or migration-review step that rejects migrations containing `UPDATE`/`DELETE` without `WHERE`.

## N+1 query patterns

Identify queries executed inside loops — a query inside a loop that could be replaced by a single `JOIN` or batch query.

**Fix:** Rewrite to a single query with a `JOIN`, or collect IDs first and use `WHERE id IN (...)`.

## Missing indexes

Check that foreign key columns referenced in `JOIN` or `WHERE` clauses have an index. Unindexed foreign keys cause full table scans when the referenced table is large.

**Fix:** Add an index on the foreign key column. For composite keys, ensure the index column order matches the most common query patterns.

## Checklist summary

| Check | Severity if violated |
|---|---|
| `UPDATE`/`DELETE` without `WHERE` | CRITICAL |
| Query inside a loop (N+1 pattern) | HIGH |
| Unindexed foreign key in `JOIN`/`WHERE` | MEDIUM |
