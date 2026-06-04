# Go code-review checklist

Extracted from `agents/3rdparty/code-reviewer.md`.

## Discarded error returns

Flag every error return that is discarded with `_` in non-trivial paths. Silent error discard is a common source of hard-to-diagnose bugs.

**Fix:** Handle the error explicitly — log it, return it, or wrap it with `fmt.Errorf("context: %w", err)`.

## Goroutine lifecycle

Check for goroutines launched without a cancellation path. Every goroutine that performs I/O or blocking work must respect a `context.Context` so it can be stopped cleanly on shutdown or timeout.

**Fix:** Accept `ctx context.Context` and check `ctx.Done()` in the goroutine's select loop.

## Defer inside loops

Flag `defer` inside loops — `defer` does not run until the surrounding function returns, not at the end of the loop iteration. This causes resource leaks (open file handles, DB connections) that grow with each iteration.

**Fix:** Extract the loop body to a separate function, or close the resource explicitly inside the loop.

## Checklist summary

| Check | Severity if violated |
|---|---|
| Error discarded with `_` in non-trivial path | HIGH |
| Goroutine without `context.Context` cancellation | HIGH |
| `defer` inside a loop | MEDIUM |
