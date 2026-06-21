---
name: ef-core-patterns
prompt_id: ef-core-patterns
version: 1.0.0
tier: domain
stack: dotnet
description: EF Core 8+ ORM patterns — query optimization, compiled queries, bulk ops, global filters, migration rules, N+1 prevention. Load when writing or reviewing EF Core queries or migrations.
owner: hero-crew
last_reviewed: 2026-06-09
triggers: ["DbContext", "IQueryable", "*.cs migration", "Add-Migration", "dotnet ef", "Include(", "AsNoTracking", "EF Core", "Npgsql", "ExecuteUpdate", "ExecuteDelete", "GlobalFilter", "HasQueryFilter"]
---

# EF Core Patterns — .NET 8+

## When to use

Load when writing repository methods, query handlers, migrations, or reviewing EF Core usage in C# code.

## Query rules

**AsNoTracking by default on reads.** Change tracking is only needed when the entity will be modified and saved in the same request.

```csharp
// Read-only query — always
var orders = await ctx.Orders
    .AsNoTracking()
    .Where(o => o.CustomerId == id)
    .Select(o => new OrderSummaryDto(o.Id, o.Total, o.Status))
    .ToListAsync(ct);
```

**Project before materializing.** Select only the columns needed — never return full entities from a query handler.

**Never return `IQueryable<T>` from a repository.** The caller cannot control query shape safely. Return `IReadOnlyList<T>` or specific DTOs.

**Never multiple-enumerate `IEnumerable<T>`.** Call `ToListAsync` once at the boundary.

## N+1 prevention

- Disable lazy loading globally (`UseLazyLoadingProxies` off — this is the default; never enable it).
- Always use explicit `Include` / `ThenInclude` or a projection.
- Detect N+1 with EF Core `LogTo` + `EnableSensitiveDataLogging` in development; query count spikes in logs signal a problem.

```csharp
// N+1 — NEVER
var orders = await ctx.Orders.ToListAsync(ct);
foreach (var o in orders) _ = o.Customer.Name; // N extra queries

// Correct — eager load
var orders = await ctx.Orders
    .AsNoTracking()
    .Include(o => o.Customer)
    .Select(o => new { o.Id, CustomerName = o.Customer.Name })
    .ToListAsync(ct);
```

## Compiled queries

Use for hot read paths called > 100 times per second. Skips query compilation overhead on every call.

```csharp
private static readonly Func<AppDbContext, Guid, Task<Order?>> GetOrderById =
    EF.CompileAsyncQuery((AppDbContext ctx, Guid id) =>
        ctx.Orders.AsNoTracking().FirstOrDefault(o => o.Id == id));

// usage
var order = await GetOrderById(ctx, orderId);
```

## Split queries

Use when an `Include` produces a large Cartesian product (multiple collection navigations on the same root).

```csharp
var orders = await ctx.Orders
    .AsNoTracking()
    .Include(o => o.Lines)
    .Include(o => o.Payments)
    .AsSplitQuery()           // two SELECTs instead of one cross-join
    .ToListAsync(ct);
```

Do not use `AsSplitQuery` when transactional consistency across the split is required.

## Query tags

Tag queries for DBA diagnosis in slow-query logs.

```csharp
var result = await ctx.Orders
    .TagWith("OrderList:CustomerId")
    .AsNoTracking()
    .Where(o => o.CustomerId == id)
    .ToListAsync(ct);
```

## Bulk operations (EF Core 7+)

Never `foreach` + `SaveChangesAsync` for bulk writes — use `ExecuteUpdateAsync` / `ExecuteDeleteAsync`.

```csharp
// Delete — one SQL statement
await ctx.Orders
    .Where(o => o.Status == OrderStatus.Abandoned && o.CreatedAt < cutoff)
    .ExecuteDeleteAsync(ct);

// Update — one SQL statement
await ctx.Orders
    .Where(o => o.CustomerId == id)
    .ExecuteUpdateAsync(s => s.SetProperty(o => o.Status, OrderStatus.Cancelled), ct);
```

`ExecuteUpdateAsync` / `ExecuteDeleteAsync` bypass change tracking — do NOT mix with tracked entities in the same `SaveChangesAsync` call.

## Global filters

Use for cross-cutting row-level concerns: soft delete, multi-tenancy. Configure in `OnModelCreating`.

```csharp
// Soft delete
modelBuilder.Entity<Order>().HasQueryFilter(o => !o.IsDeleted);

// Multi-tenancy (resolve tenant from scoped service)
modelBuilder.Entity<Order>().HasQueryFilter(o => o.TenantId == _tenantId);
```

Always provide `IgnoreQueryFilters()` escape hatch for admin/maintenance queries.

## Interceptors

Use for audit logging, correlation tagging, or telemetry — not for business logic.

```csharp
public class AuditInterceptor : SaveChangesInterceptor
{
    public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
        DbContextEventData e, InterceptionResult<int> result, CancellationToken ct)
    {
        foreach (var entry in e.Context!.ChangeTracker.Entries<IAuditable>()
            .Where(x => x.State is EntityState.Added or EntityState.Modified))
        {
            entry.Entity.UpdatedAt = DateTimeOffset.UtcNow;
        }
        return base.SavingChangesAsync(e, result, ct);
    }
}
```

## Migration rules

- Every `Up` migration **must** have a corresponding `Down` that fully reverses it.
- Never edit a migration already applied to any environment — add a new one.
- Test with `dotnet ef migrations script --idempotent` before committing.
- Destructive changes (drop column, drop table, rename) require a multi-step migration sequence: add nullable column → backfill → add constraint → drop old column (each step as a separate migration deployed separately).
- Never put business logic inside a migration — only schema DDL and data backfills.

## Done criteria

- All read queries use `AsNoTracking()` unless entity will be modified in the same request.
- No lazy loading enabled anywhere.
- All includes are explicit; no N+1 patterns detected.
- Hot read paths (> 100 req/s) use compiled queries.
- Bulk operations use `ExecuteUpdateAsync` / `ExecuteDeleteAsync`, not `foreach` + `SaveChanges`.
- Every migration has a reversible `Down` method.
- Migration script validated with `--idempotent` flag.
- No `IQueryable<T>` returned from repository methods.
