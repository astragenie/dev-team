---
name: ts-conventions
tier: domain
stack: typescript
description: TypeScript strict-mode conventions — types, Result<T,E>, branded IDs, Zod validation, React patterns, approved libraries. Use when touching *.ts or *.tsx files.
owner: sergeymilashico
last_reviewed: 2026-05-24
triggers: ["*.ts", "*.tsx", "tsconfig.json", "typescript", "react"]
---

# TypeScript Conventions

Standalone — no upstream Standards doc yet. Candidate for `Astragenie.Standards/docs/typescript/` follow-on.

## When to Use

Lead: recommend when a builder touches `.ts` / `.tsx` files, creates a new React component, or reviews TS PRs.

When unsure of a TS-typed library's current API (e.g. `zod`, `react`, `@tanstack/*`, type-shape changes between majors), call **context7 MCP** (`resolve-library-id` → `get-library-docs`) before editing. See `docs/routing-table.md` row "Library / API uncertainty".

## Compiler requirements

`tsconfig.json` must include `strict: true`, `noUncheckedIndexedAccess: true`, `exactOptionalPropertyTypes: true`, `noImplicitOverride: true`, `noUnusedLocals: true`, `noUnusedParameters: true`, `verbatimModuleSyntax: true`. Non-negotiable.

## Key type rules

- **No `any`.** Use `unknown` + narrowing or a real type.
- **No `as X`** without prior runtime validation (Zod or narrowing).
- **No `// @ts-ignore`** without an explanation comment.
- **Branded types** for every domain ID, money, timestamp: `type OrderId = Brand<string, 'OrderId'>`.
- **Discriminated unions** for state, not boolean flags.
- **No `enum`** — use `as const` literal unions.
- **No barrel files** (`index.ts` re-exports) — import the source file directly.

## Result<T, E>

```ts
export type Result<T, E> =
  | { readonly ok: true;  readonly value: T }
  | { readonly ok: false; readonly error: E };
export const ok  = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
```

Use for domain operations with expected failure modes (validation, business rules). Network failures throw — caught at boundary by error boundary or global handler.

## Zod at boundaries

Validate at every external boundary (HTTP responses, form input, env vars, URL params):

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
| Single-component | `useState` |
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

**Approved:** `react` + `react-dom` (18), `react-router-dom` (6), `vite` (5), `vitest` (1+), `@testing-library/react` (14+), `zod` (3), `@tanstack/react-query` (5), `zustand` (4), `react-hook-form` (7), `clsx` (2), `date-fns` (3), `@radix-ui/*` (1).

**Banned:** `moment`, `lodash` (full import), `redux` / `react-redux` (new code), `styled-components` / `@emotion/*`, `enzyme`, `formik`, `mobx`.

## Imports

- Type-only imports use `import type` (compiler enforces under `verbatimModuleSyntax: true`).
- No `import * as X` unless library has no named exports.
- No deep node_modules paths unless `package.json` `exports` allows it.

## Testing

- `vitest` + `@testing-library/react`. No Jest in new code.
- Co-locate `*.test.ts` / `*.test.tsx` next to the unit under test.
- One behavior per `test()` — no bundled unrelated assertions.
- Mock at module boundary (`vi.mock`), not at function call sites.
- `screen.findBy*` over `getBy*` for anything that appears async.

## Async rules

- `async/await`. No `.then` chains beyond one link.
- No floating Promises — every Promise is awaited, returned, or fire-and-forgot with a logged catch.
- `AbortController` for cancellable fetches.

## Done criteria

- `tsc --noEmit` clean with `strict: true`.
- No `any`, no `as` without runtime validation.
- Every domain ID is a branded type.
- Every external boundary validated with Zod.
- All async operations awaited or explicitly fire-and-forgot with logged catch.
- No `React.FC`, no class components.

## LLM guardrails

- Do not invent npm packages — check `package.json` first.
- Do not introduce a state-management library for single-component state.
- Do not return `null` from a function implying success/failure — return `Result<T, E>`.
- Do not call `setState` inside render or unconditionally inside an effect.
- Do not import from `node_modules` deep paths unless the exports map specifies it.
