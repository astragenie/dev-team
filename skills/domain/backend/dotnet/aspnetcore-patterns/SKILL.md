---
name: aspnetcore-patterns
prompt_id: aspnetcore-patterns
version: 1.1.0
tier: domain
stack: dotnet
description: ASP.NET Core production patterns for .NET 10 — controller-based routing (regular ASP.NET Core MVC), middleware ordering, health checks, output caching, rate limiting, API versioning, exception handling. Load when building or reviewing ASP.NET Core controller endpoints.
owner: hero-crew
last_reviewed: 2026-06-21
triggers: ["Program.cs", "Startup.cs", "*.Api", "WebApplication", "MapControllers", "ControllerBase", "ApiController", "HttpGet", "HttpPost", "middleware", "health", "rate limit", "api version", "Authorize"]
---

# ASP.NET Core Patterns

Production patterns for **ASP.NET Core on .NET 10** using **regular controller-based routing** (NOT minimal APIs).

## When to use

Load when building new controller endpoints, reviewing middleware configuration, wiring health checks, adding rate limiting, or configuring API versioning.

## Controllers are the default

This product targets **regular ASP.NET Core controllers**, not minimal APIs. Reasons:

- Consistent `[ApiController]` attribute auto-validation + ProblemDetails responses
- MVC filter pipeline (auth, model binding, action filters) is the contract
- Strong typing via `[FromBody]` / `[FromQuery]` / `[FromRoute]` + DTOs as records
- Easier to integrate with established repos that use controller patterns

Controller skeleton:

```csharp
[ApiController]
[Route("api/[controller]")]
public sealed class UsersController(IUserService users, ILogger<UsersController> logger)
    : ControllerBase
{
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<UserDto>> GetAsync(
        Guid id,
        CancellationToken ct)
    {
        var user = await users.FindAsync(id, ct);
        return user is null ? NotFound() : Ok(user);
    }

    [HttpPost]
    public async Task<ActionResult<UserDto>> CreateAsync(
        [FromBody] CreateUserRequest request,
        CancellationToken ct)
    {
        // [ApiController] auto-validates ModelState → 400 ProblemDetails
        var created = await users.CreateAsync(request, ct);
        return CreatedAtAction(nameof(GetAsync), new { id = created.Id }, created);
    }
}
```

Wire in `Program.cs`:

```csharp
builder.Services.AddControllers();
// ... other services
var app = builder.Build();
app.MapControllers();
```

## Middleware pipeline ordering

Order matters — configure in this sequence in `Program.cs`:

```csharp
app.UseExceptionHandler();      // 1. catch everything
app.UseHttpsRedirection();      // 2. redirect before any processing
app.UseRateLimiter();           // 3. reject excess before auth
app.UseCors();                  // 4. CORS before auth
app.UseAuthentication();        // 5. establish identity
app.UseAuthorization();         // 6. enforce policy
app.UseOutputCache();           // 7. serve cached after auth
app.MapEndpoints();             // 8. route to handlers
```

Never place custom middleware between `UseAuthentication` and `UseAuthorization`.

## Health checks

Every service must expose three endpoints. Wire at startup — not optional.

```csharp
builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>()          // DB liveness
    .AddUrlGroup(new Uri("https://dep/health"), "downstream");

app.MapHealthChecks("/health");                 // liveness — is the process alive?
app.MapHealthChecks("/ready", new() {           // readiness — can it serve traffic?
    Predicate = r => r.Tags.Contains("ready")
});
app.MapPrometheusScrapingEndpoint("/metrics");  // metrics — OpenTelemetry export
```

Kubernetes probes point to `/health` (liveness) and `/ready` (readiness).

## Output caching

Prefer output caching over response caching for .NET 8+. Configure per-endpoint.

```csharp
builder.Services.AddOutputCache(o => {
    o.AddPolicy("Short", p => p.Expire(TimeSpan.FromSeconds(30)));
    o.AddPolicy("ByUser",  p => p.Expire(TimeSpan.FromMinutes(5))
                                  .SetVaryByHeader("Authorization"));
});

// controller action — apply [OutputCache(PolicyName = "Short")] attribute
[HttpGet]
[OutputCache(PolicyName = "Short")]
public async Task<ActionResult<IEnumerable<ProductDto>>> GetProducts(CancellationToken ct) => Ok(await service.ListAsync(ct));
```

Never cache endpoints that write state or return user-specific sensitive data without explicit vary-by.

## Rate limiting

Apply at the middleware level, not per-endpoint, unless policy differs per route.

```csharp
builder.Services.AddRateLimiter(o => {
    o.AddFixedWindowLimiter("api", cfg => {
        cfg.PermitLimit = 100;
        cfg.Window = TimeSpan.FromMinutes(1);
        cfg.QueueProcessingOrder = QueueProcessingOrder.OldestFirst;
        cfg.QueueLimit = 10;
    });
    o.OnRejected = async (ctx, ct) => {
        ctx.HttpContext.Response.StatusCode = 429;
        await ctx.HttpContext.Response.WriteAsync("Too many requests.", ct);
    };
});
app.UseRateLimiter();
```

Use `SlidingWindowLimiter` for burst-tolerant endpoints; `TokenBucketLimiter` for APIs with a sustained budget.

## API versioning

Use `Asp.Versioning` package (not the deprecated `Microsoft.AspNetCore.Mvc.Versioning`).

```csharp
builder.Services.AddApiVersioning(o => {
    o.DefaultApiVersion = new ApiVersion(1);
    o.AssumeDefaultVersionWhenUnspecified = true;
    o.ReportApiVersions = true;
    o.ApiVersionReader = ApiVersionReader.Combine(
        new HeaderApiVersionReader("api-version"),
        new QueryStringApiVersionReader("v"));
});
```

Never break existing contract in an existing version — add a new version. Deprecate with `[MapToApiVersion]` + `Deprecated = true`.

## Global exception handling

Use `IProblemDetailsService` + `UseExceptionHandler` — never catch-and-swallow in endpoints.

```csharp
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
app.UseExceptionHandler();

// GlobalExceptionHandler maps domain exceptions to HTTP status codes
// NotFoundException → 404, ValidationException → 422, etc.
```

Never return raw exception messages to the client. Use `ProblemDetails` RFC 9457 format.

## Options pattern

Typed config — no `IConfiguration["key"]` inline in services.

```csharp
builder.Services.AddOptions<SmtpOptions>()
    .BindConfiguration("Smtp")
    .ValidateDataAnnotations()
    .ValidateOnStart();   // fail fast at startup, not at first use
```

## Done criteria

- Middleware registered in the documented order
- `/health`, `/ready`, `/metrics` endpoints present
- All external dependencies covered by health checks
- Rate limiter configured and registered before auth
- API version header reported (`api-version` header in response)
- Global exception handler maps domain errors to `ProblemDetails`
- No `IConfiguration["key"]` string indexing inside service classes
