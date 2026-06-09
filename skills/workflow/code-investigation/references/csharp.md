# C#/.NET investigation first-checks

Read-only heuristics: what an expert checks first when tracing behavior or
hunting root cause in a .NET codebase. Each check names the evidence location
so findings cite file:line, not folklore.

## 1. Project file & target frameworks

Open the `.csproj` (and `Directory.Build.props` if present) before reading code:

- `<TargetFramework>` / `<TargetFrameworks>` — multi-targeting changes the
  available API surface per TFM; a bug may exist on only one target.
- `<Nullable>` — whether nullable reference types are enforced. Code written
  under `disable` carries silent null assumptions everywhere.
- `<LangVersion>`, `<ImplicitUsings>` — explain "where does this symbol come from".
- Package versions + `<PackageReference>` constraints — verify claimed library
  versions against the csproj/lockfile, never against memory or docs.

## 2. Async & concurrency

Highest-yield grep targets for deadlocks, hangs, and thread-pool starvation:

- `.Result`, `.Wait()`, `.GetAwaiter().GetResult()` — sync-over-async; deadlock
  risk under a synchronization context, starvation risk under load.
- `async void` — exceptions escape the caller; only valid on event handlers.
- Missing `CancellationToken` propagation — token accepted but not passed down
  the chain means cancellation silently stops working mid-stack.
- `ConfigureAwait(false)` in library code vs absent in app code — context.
- `Task.Run` wrapping synchronous work inside ASP.NET request paths.

## 3. Dependency injection lifetimes

- Captive dependency: a `Scoped`/`Transient` service injected into a
  `Singleton` constructor gets frozen at first resolution. Grep the
  registration site (`AddSingleton`/`AddScoped`/`AddTransient`) and compare
  against constructor parameters of the singleton.
- `IServiceProvider.GetService` inside constructors — service-locator pattern;
  lifetimes become invisible to the container's validation.
- `BuildServiceProvider()` called more than once — duplicate singletons.
- Registration order producing circulars — check for `Lazy<T>` workarounds as
  a smell that a circular exists.

## 4. Nullability & null-safety

- `#nullable disable` / `#nullable restore` directives carving holes in an
  otherwise-enabled project — crashes cluster in these regions.
- `!` (null-forgiving) density — each one is a suppressed warning; in a crash
  investigation, treat them as prime suspects.
- `default!` on non-nullable properties — deferred initialization the compiler
  can no longer check.

## 5. Structure & SOLID (for option analysis / impact tracing)

- Classes with multiple reasons to change (mixed I/O + domain logic) — high
  blast radius for any edit; flag in impact analysis.
- High-level modules referencing concrete implementations instead of
  abstractions — constrains which options are cheap to implement.
- Interfaces with members most implementers stub out — segregation violation;
  signals the abstraction won't fit a new use cleanly.

## Citation pattern

`src/Services/CacheService.cs:42 (verified-in-code): "services.AddSingleton<ICacheService, CacheService>()" — captures IDbContext (scoped) via ctor at :17.`
