---
name: csharp-conventions
prompt_id: csharp-conventions
version: 1.0.0
tier: domain
stack: dotnet
description: C# .NET 10 conventions — architecture, SOLID idioms, approved libraries, and code shapes. Use when touching *.cs files.
owner: astra
last_reviewed: 2026-05-22
triggers: ["*.cs", "*.csproj", ".sln", "dotnet", "csharp"]
---

# C# Conventions — .NET 10

Source: `Astragenie.Standards/docs/csharp/coding-conventions.md`

## When to Use

Lead: recommend when a builder is about to touch `.cs` files, create a new service project, or review C# PRs.

## Project structure

```
src/
  <Name>.Api/             # Controllers, middleware, DI wiring
  <Name>.Application/     # Use-case orchestration, DTOs
  <Name>.Domain/          # Entities, value objects, domain events
  <Name>.Infrastructure/  # EF Core, HTTP clients, integrations
tests/
  <Name>.Tests/           # xUnit unit + integration
```

Dependency direction: **Api → Application → Domain ← Infrastructure**. Domain references nothing outside itself.

## Key rules

**DI**
- Constructor injection only. No service locator.
- `Scoped` for `DbContext`, `Singleton` for stateless, `Transient` sparingly.
- `AddHttpClient<T>()` — never `new HttpClient()`.

**Types**
- `sealed` by default. Open only when designing for extension.
- DTOs → `record`. Value objects → `record struct`. Entities → `class` with private setters. Services → `sealed class`.
- No public setters. Mutate via methods; replace records via `with`.
- Typed IDs: `record struct OrderId(Guid Value)` — never raw `string` for domain IDs.

**Error handling**
- `Result<T, TError>` for domain operations with expected failure modes.
- Infrastructure failures (DB down, network) still throw — caught by global exception middleware.
- Never `catch (Exception) { }` empty swallow.
- Never `async void` (except event handlers).

**Async**
- `CancellationToken` on every async public method.
- Never `.Result`, `.Wait()`, `.GetAwaiter().GetResult()`.
- `AsNoTracking()` on every EF read query.

**LINQ**
- No multiple enumeration of `IEnumerable<T>`. `ToList()` once at the materialisation boundary.
- Project before materialising: `Select(...).ToListAsync()`.
- Never return `IQueryable<T>` from a repository.

**Size budgets** (CI-enforced via Roslyn analyzers)

| Budget | Limit |
|---|---|
| Class lines | ≤ 300 |
| Method lines | ≤ 30 |
| Parameters | ≤ 4 |
| Cyclomatic complexity | ≤ 10 |
| Nesting depth | ≤ 3 |

## Approved / banned libraries

**Approved:** `FluentValidation` (11), `Mapperly` (4), `Serilog.AspNetCore` (8), `Scrutor` (5), `Refit` (7), `xUnit` (2), `NSubstitute` (5), `Testcontainers.PostgreSql` (4), `FluentAssertions` (6), `EF Core + Npgsql` (9), `MediatR` (12) — **only when ≥ 5 handlers share a pipeline**.

**Banned:** `AutoMapper` (use Mapperly), `Newtonsoft.Json` (use STJ), `Moq` (use NSubstitute), `EFCore.InMemory` (use Testcontainers), generic `IRepository<T>`.

## CQRS + Event Sourcing patterns

Use when `stack:csharp` slice involves command/query separation or event-driven state:

**CQRS basics**
- Commands (write) and Queries (read) are separate handler classes — never mixed
- Commands return `Result<T, E>` (no return value for fire-and-forget commands)
- Queries return DTOs — never domain entities
- Use `MediatR` only when ≥ 5 handlers share a pipeline (global validation, logging, auth); otherwise plain interfaces
- Command handlers live in `Application/`; query handlers may use optimised read-store queries directly

**Event Sourcing** (opt-in — use only when audit trail or temporal replay is a hard requirement)
- Aggregate state is rebuilt from a stream of domain events, not from a snapshot column
- Events are immutable, named in past tense: `OrderPlaced`, `ItemShipped`
- Projections rebuild read models from the event stream — they are eventually consistent
- `EventStoreDB` or `Marten` (PostgreSQL) are the approved event stores; no ad-hoc `EventLog` table

**BDD test naming** (applies to all C# test projects, not just event-sourcing)
- Use `[Fact]` for single-scenario tests; name as `Method_Condition_ExpectedBehavior`
- Use `[Theory]` for data-driven variations; combine with `FluentAssertions` for readable assertions
- `SpecFlow` is allowed for user-facing acceptance tests when product owner writes Gherkin; do NOT add it for developer unit tests
- All tests use `xUnit` + `NSubstitute` + `FluentAssertions` — no Moq, no MSTest

## Async depth

- `ConfigureAwait(false)` on every `await` in library/helper code; omit in application entry points and UI.
- `ValueTask` only when measured to reduce allocations on hot, frequently-completing paths; default to `Task`.
- Async streams: `IAsyncEnumerable<T>` + `await foreach` for streaming endpoints; never buffer then return list.
- Channels: `Channel<T>.CreateBounded(N)` for producer/consumer pipelines; prefer over `BlockingCollection`.
- Bounded parallelism: `Parallel.ForEachAsync(source, new ParallelOptions { MaxDegreeOfParallelism = N }, ...)` — never `Task.WhenAll` over an unbounded list.
- Stream large JSON: `GetAsync(..., ResponseHeadersRead)` → `ReadAsStreamAsync` → `JsonDocument.ParseAsync`; never `ReadAsStringAsync` for large payloads.

## Performance hot paths

- Measure first: `BenchmarkDotNet` for CPU/allocation, `dotMemory` or `dotnet-counters` for GC pressure; no optimization without a baseline.
- `Span<T>` / `ReadOnlySpan<T>` for stack-allocated slicing; `Memory<T>` when async or stored.
- `ArrayPool<T>.Shared.Rent` / `.Return` for temporary buffers — never `new byte[N]` in a loop.
- Avoid boxing on hot paths: prefer `struct` for small value types, avoid `object` parameters, use generic constraints.
- String: `StringBuilder` or `string.Create(...)` in loops; `string.Concat` / interpolation only for one-offs.

## Structured logging + resilience

- `ArgumentNullException.ThrowIfNull(x)` for null guards; `string.IsNullOrWhiteSpace` for strings; guard early, no `!` operator.
- Structured logging with `ILogger`: named scopes (`using var _ = logger.BeginScope(...)`), correlation/trace IDs, no free-text interpolation in message templates — use named properties.
- Never log sensitive data (PII, credentials, connection strings, tokens).
- Resilient I/O: wrap all external calls (HTTP, DB, queue) with Polly `ResiliencePipeline` — retry with exponential backoff + jitter, timeout, optional circuit breaker. Wire via `AddResilienceHandler` in DI.
- Precise exceptions: `ArgumentException`, `InvalidOperationException`, `NotFoundException` — never `throw new Exception(...)`.

## Example — typed Result

```csharp
// domain method
public Result<Order, OrderError> Place(Cart cart, Customer customer)
{
    if (cart.Items.Count == 0)
        return Result<Order, OrderError>.Err(new("cart.empty", "Cart has no items"));
    return Result<Order, OrderError>.Ok(new Order(cart, customer));
}

// controller — 3-5 line forwarder
[HttpPost]
public IActionResult Place(PlaceOrderRequest req)
    => _service.Place(req).Match<IActionResult>(
        ok:  o => CreatedAtAction(nameof(Get), new { id = o.Id }, o),
        err: e => Problem(detail: e.Detail, title: e.Code, statusCode: 400));
```

## Done criteria

- All new classes are `sealed` unless explicitly opened.
- No `.Result` / `.Wait()` anywhere in new code.
- No `IRepository<T>` god interface.
- Every domain method returning a failure mode returns `Result<T, E>`.
- Tests use xUnit + NSubstitute + Testcontainers (not EFCore.InMemory).
- Build passes with `TreatWarningsAsErrors=true`.

## LLM guardrails

- Do not invent NuGet packages. Check `Directory.Packages.props` or `.csproj` first.
- Do not introduce unlisted libraries without asking.
- Do not return `null` from a public method — use `Result`, a typed exception, or `T?` with explicit null handling.
- Do not add `!` (null-forgiving) to silence a warning — fix the underlying flow.
- Do not write reflection-based code — use source generators.
