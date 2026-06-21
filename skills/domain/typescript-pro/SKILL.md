---
name: typescript-pro
prompt_id: typescript-pro
version: 1.1.0
tier: domain
maxLines: 250
description: TypeScript 5.0+ authority — strict-mode conventions, Astra opinions (Result<T,E>, Zod boundaries, approved libs, size budgets, LLM guardrails), advanced generics, full-stack type safety, build tooling, monorepo patterns. Consult when writing or reviewing any TypeScript code. Absorbs the prior ts-conventions skill content (2026-06-21).
source: aitmpl/programming-languages/typescript-pro
source_version: 2026-06-04
last_reviewed: 2026-06-21
owner: hero-crew
triggers: ["*.ts", "*.tsx", "tsconfig.json", "tsconfig.*.json", "typescript", "react", "zod", "branded", "Result"]
---

# TypeScript Pro

Specialist guidance for type-safe, production-ready TypeScript code in the Astra ecosystem. Generic type-system depth + repo-opinionated rules in one file.

## When to use

- Writing or reviewing TypeScript code (any framework or runtime)
- Designing type-safe APIs, libraries, or shared type packages
- Migrating JavaScript to TypeScript
- Troubleshooting type errors, inference failures, slow compile times
- Setting up monorepo project references or declaration bundling

When unsure of a TS-typed library's current API (`zod`, `react`, `@tanstack/*`, type-shape changes between majors), call **context7 MCP** (`resolve-library-id` → `get-library-docs`) before editing.

## Compiler requirements (non-negotiable)

`tsconfig.json` MUST include: `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `noImplicitOverride: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `verbatimModuleSyntax: true`.

## Key type rules

- **No `any`.** Use `unknown` + narrowing or a real type.
- **No `as X`** without prior runtime validation (Zod or narrowing).
- **No `// @ts-ignore`.** Use `// @ts-expect-error` with an explanation when intentional.
- **Branded types** for every domain ID, money, timestamp: `type OrderId = string & { readonly __brand: 'OrderId' }`.
- **Discriminated unions** for state, not boolean flags.
- **No `enum`** — use `as const` literal unions.
- **No barrel files** (`index.ts` re-exports) — import the source file directly.
- **`satisfies` operator** to validate shape while preserving literal types (TS 4.9+).

## Result<T, E>

Use for domain operations with expected failure modes (validation, business rules). Network failures throw — caught at boundary by error boundary or global handler.

```ts
export type Result<T, E> =
  | { readonly ok: true;  readonly value: T }
  | { readonly ok: false; readonly error: E };
export const ok  = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
```

Pair with `never` to enforce exhaustive union handling. Prefer Zod `.safeParse()` over `.parse()` — it returns the same shape.

## Zod at boundaries

Validate at every external boundary (HTTP responses, form input, env vars, URL params, queue messages):

```ts
const UserSchema = z.object({ id: z.string().uuid().transform(UserId), email: z.string().email() });
type User = z.infer<typeof UserSchema>;
```

Inside the app, work with the typed value — do not re-validate.

## React patterns

- Functional components only. No class components. No `React.FC`.
- Page components: default export. Shared components: named export.
- Props as `interface Props` — inline props only for one-off internal components.
- `useEffect` dependencies must be complete — no `eslint-disable react-hooks/exhaustive-deps`.
- `useRef` is for DOM access and mutable values that don't trigger renders — not for stale closure workarounds.
- No `<div onClick>` as a button. No index-as-key in dynamic lists.

## State management

| Need | Use |
|---|---|
| Single-component state | `useState` |
| Non-trivial forms | `react-hook-form` + Zod resolver |
| Server cache | `@tanstack/react-query` |
| Shared cross-route client state | `zustand` |
| Redux (new code) | **Never** |

## Size budgets

| Budget | Limit |
|---|---|
| Component lines | ≤ 200 |
| Hook lines | ≤ 80 |
| File lines | ≤ 300 |
| Function lines | ≤ 30 |
| Parameters | ≤ 4 |
| `useEffect` per component | ≤ 3 |
| Nested ternaries | 0 |

## Approved / banned libraries

**Approved:** `react` + `react-dom` (18+), `react-router-dom` (6+), `vite` (5+), `vitest` (1+), `@testing-library/react` (14+), `zod` (3+), `@tanstack/react-query` (5+), `zustand` (4+), `react-hook-form` (7+), `clsx` (2+), `date-fns` (3+), `@radix-ui/*` (1+).

**Banned:** `moment`, `lodash` (full import — use specific modules), `redux` / `react-redux` (new code), `styled-components` / `@emotion/*`, `enzyme`, `formik`, `mobx`.

## Imports

- Type-only imports use `import type` (enforced under `verbatimModuleSyntax: true`).
- No `import * as X` unless the library has no named exports.
- No deep node_modules paths unless `package.json` `exports` allows it.

## Advanced type patterns

- **Conditional types** — `T extends U ? A : B` for flexible API shapes.
- **Mapped types** — transform object shapes without duplication.
- **Template literal types** — typed string manipulation (`` `on${Capitalize<K>}` ``).
- **Type predicates** — `(x): x is T` for narrowing across call boundaries.
- **Const assertions** — `as const` for literal inference on tuples and objects.
- **`infer`** for extracting types from conditional positions.
- **Distributive conditionals** — wrap in `[T]` when you need to prevent distribution.
- **Utility types** — `ReturnType<F>`, `Parameters<F>`, `InstanceType<C>`, `Awaited<P>`.

## Full-stack type safety

- Shared type packages in monorepo (`packages/types/`).
- Generated types: `openapi-typescript` (type-only, no runtime), `@graphql-codegen/typescript-operations`, Prisma / Drizzle schema introspection.
- Zod as single source of truth: derive types via `z.infer<typeof Schema>`.

## Async rules

- `async/await`. No `.then` chains beyond one link.
- No floating Promises — every Promise is awaited, returned, or fire-and-forgot with a logged catch.
- `AbortController` for cancellable fetches.
- `using` / `await using` (ES2025 explicit resource management) for disposables: file handles, DB connections, streams, timers. Prefer over `try/finally`.

## Testing

- `vitest` + `@testing-library/react`. No Jest in new code.
- Co-locate `*.test.ts` / `*.test.tsx` next to the unit under test.
- One behavior per `test()`.
- Mock at module boundary (`vi.mock`), not at function call sites.
- `screen.findBy*` over `getBy*` for anything that appears async.
- Type-level tests: `expectTypeOf` (vitest) or `tsd` for complex generics.
- `@ts-expect-error` (not `@ts-ignore`) for intentional type-error tests.

## Build and tooling

- `moduleResolution: bundler` (TS 5+) or `node16` for Node.
- Project references (`composite: true`, `references: [...]`) for monorepos.
- Incremental compilation (`incremental: true`) for large codebases.
- Path mapping (`paths`) — document each alias.
- Declaration bundling for libraries: `dts-bundle-generator` or `tsup`.

## Supply chain security

- `ignore-scripts=true` in `.npmrc` — blocks install-time scripts from untrusted packages.
- Verify lockfile in CI (`npm ci` / `pnpm install --frozen-lockfile`) — rejects unapproved changes.
- Audit new packages before adding: recent activity, suspicious version jumps, known CVEs (`npm audit`), typosquatting risk.
- Do not introduce packages not in `package.json` without review.

## Node.js runtime targets

| Runtime | When to use |
|---|---|
| Node.js 22 LTS | Default: stable ESM, native fetch, `node:test`, improved CJS interop |
| Node.js 24 LTS | When native TS type-stripping (`--experimental-strip-types`) is needed without a build step |
| Bun | Performance-critical scripts; not for production services without explicit team decision |

Deep Node runtime patterns (workers, streams, AsyncLocalStorage, process lifecycle): `skills/domain/backend/node-ts-patterns/`.

## LLM guardrails

- Do not invent npm packages — check `package.json` first.
- Do not introduce a state-management library for single-component state.
- Do not return `null` from a function implying success/failure — return `Result<T, E>`.
- Do not call `setState` inside render or unconditionally inside an effect.
- Do not import from deep `node_modules` paths unless the exports map specifies it.

## Done / Acceptance

- `tsc --noEmit` exits 0 with `strict: true`.
- ESLint (`@typescript-eslint`) / Biome exits with zero errors/warnings.
- No `any`, no `as X` without runtime validation.
- Every domain ID is a branded type.
- Every external boundary validated with Zod.
- All async operations awaited or explicitly fire-and-forgot with logged catch.
- No `React.FC`, no class components.
- Bundle size verified for library / FE packages.
- Declaration files present and correct for library packages.
