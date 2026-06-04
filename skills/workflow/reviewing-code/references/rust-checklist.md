# Rust code-review checklist

Extracted from `agents/3rdparty/code-reviewer.md`.

## Panic-on-failure calls

Flag `.unwrap()` and `.expect()` outside of test modules. These panic at runtime on `None` / `Err`, which is rarely appropriate in production code.

**Fix:** Use `?` propagation, `if let`, or `match` with explicit error handling. Reserve `.unwrap()` / `.expect()` for genuinely unreachable error states where a panic is the correct response (document why).

## Unsafe blocks

Require a `// SAFETY:` comment on every `unsafe` block explaining the invariant being upheld by the caller. The comment must describe what the surrounding code guarantees that makes the operation sound.

## Lifetime annotations

Flag missing lifetime annotations on public API functions that return references. The compiler will accept some cases via lifetime elision, but explicit annotations improve readability and catch mistakes when APIs evolve.

## Checklist summary

| Check | Severity if violated |
|---|---|
| `.unwrap()` / `.expect()` outside tests | HIGH |
| `unsafe` block without `// SAFETY:` comment | CRITICAL |
| Missing lifetime annotations on public ref-returning fns | MEDIUM |
