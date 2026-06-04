# TypeScript code-review checklist

Extracted from `agents/3rdparty/code-reviewer.md`.

## Type safety

- Flag every use of `any` — require a typed alternative or an explicit suppression comment explaining why `any` is necessary.
- Confirm `strict: true` is present in `tsconfig.json`; report its absence as a HIGH finding.

## Async / Promise handling

- Verify every `Promise` is awaited or explicitly handled via `.then()` / `.catch()`.
- Search for floating Promise chains — a call that returns a `Promise` whose result is discarded without `void` annotation.

## Null safety

- Check that `null` and `undefined` are handled before property access.
- Flag implicit omissions of optional chaining (`?.`) in critical paths where the value could realistically be absent.

## Checklist summary

| Check | Severity if violated |
|---|---|
| `any` without justification comment | HIGH |
| `strict: true` absent from tsconfig | HIGH |
| Floating (unawaited) Promise | HIGH |
| Missing null guard on property access | MEDIUM |
