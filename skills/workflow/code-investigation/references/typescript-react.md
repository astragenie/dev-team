# TypeScript / React investigation first-checks

Read-only heuristics for tracing behavior and hunting root cause in TS/React
codebases. Each check names the evidence location so findings cite file:line.

## 1. tsconfig before code

Open `tsconfig.json` (and any extended base) before trusting the types:

- `strict`, `strictNullChecks`, `noUncheckedIndexedAccess` — off means the type
  annotations overpromise; a `string` may be `undefined` at runtime.
- `skipLibCheck`, `paths` aliases — explain "why does this import resolve" and
  "why didn't the broken dependency types fail the build".
- Multiple tsconfigs (app/test/build) — a file may compile under different
  strictness than you assume; check which config owns it (`include`/`references`).

## 2. Type-escape hatches

In a correctness investigation, suppressions are prime suspects — grep first:

- `as` casts and `as unknown as` double-casts — the compiler was overruled here.
- `!` non-null assertions — suppressed nullability; crash sites cluster nearby.
- `any` (explicit or via untyped imports), `@ts-ignore`, `@ts-expect-error` —
  each marks a place where runtime shape can diverge from declared type.
- Zod/io-ts/manual validation at I/O boundaries — its absence means external
  data flows in with asserted, unverified types.

## 3. React render & state

- Inline object/array/function props → new reference every render → child
  re-renders or effect re-fires. Check the prop site, then whether the child
  is memoized and whether the effect lists that prop as a dependency.
- Hook dependency arrays: missing deps cause stale closures (bug reads as
  "uses old value"); over-broad deps cause loops (reads as "fires forever").
- State updates from props without sync (`useState(props.x)`) — initial-value-
  only; later prop changes silently ignored.
- Context value created inline at the provider — re-renders every consumer.
- Keys on lists: index keys + reordering = state bleeding between rows.

## 4. Module & dependency tracing

- Barrel files (`index.ts` re-exports) widen the import blast radius — impact
  analysis must trace through them, not stop at the barrel.
- Circular imports: symptom is `undefined` at module-eval time; verify with
  `npx madge --circular` (read-only) when suspected.
- `package.json` `exports`/`types` fields vs actual import paths — explains
  "works in dev, breaks in build" class of issues.
- Verify claimed package versions against the lockfile, not the README.

## 5. Async & data flow

- Un-awaited promises (`floating` promises) — errors vanish; grep call sites of
  the failing function for missing `await`/`void`.
- Race: two fetches updating the same state without abort/last-write-wins
  guards — reads as "intermittently shows wrong data".
- `AbortController` propagation through fetch wrappers — same shape as
  CancellationToken tracing in C#.

## Citation pattern

`src/hooks/useCart.ts:31 (verified-in-code): "useEffect(() => { sync(items) }, [])" — items omitted from deps; stale closure confirmed by test gap (no test asserts re-sync).`
