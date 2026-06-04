---
name: typescript-pro
tier: domain
description: TypeScript 5.0+ type system mastery — advanced generics, full-stack type safety, build tooling, and monorepo patterns. Consult when writing or reviewing TypeScript code.
source: aitmpl/programming-languages/typescript-pro
source_version: 2026-06-04
last_reviewed: 2026-06-04
owner: hero-crew
triggers: ["*.ts", "*.tsx", "tsconfig.json", "tsconfig.*.json"]
---

# TypeScript Pro

Specialist guidance for type-safe, production-ready TypeScript development.

## When to use

Consult this skill when:
- Writing or reviewing TypeScript code (any framework or runtime)
- Designing type-safe APIs, libraries, or shared type packages
- Migrating JavaScript to TypeScript (gradual or full)
- Troubleshooting type errors, inference failures, or slow compile times
- Setting up monorepo project references or declaration bundling

## Development Checklist

- `strict: true` in tsconfig plus `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`
- No `any` without explicit comment justification
- 100% type coverage on all public APIs
- ESLint (`@typescript-eslint`) + Prettier configured and passing
- Test coverage >90%
- Source maps configured; declaration files generated for libraries
- Bundle size verified after changes

## Advanced Type Patterns

- **Conditional types** — `T extends U ? A : B` for flexible API shapes
- **Mapped types** — transform object shapes without duplication
- **Template literal types** — typed string manipulation (`\`on${Capitalize<K>}\``)
- **Discriminated unions** — model state machines; exhaustive checking via `never`
- **Branded types** — `type UserId = string & { readonly __brand: 'UserId' }` for domain safety
- **Type predicates** — `(x): x is T` for narrowing across call boundaries
- **Const assertions** — `as const` for literal inference on tuples and objects
- **`satisfies` operator** — validate shape while preserving literal types (TS 4.9+)

## Type System Depth

- `infer` for extracting types from conditional positions
- Distributive conditional types — understand when to wrap in `[T]` to prevent distribution
- Recursive type definitions for tree/nested structures
- Higher-kinded type simulation via mapped type + generic helpers
- Index access types: `Type[Key]` for deep property extraction
- `ReturnType<F>`, `Parameters<F>`, `InstanceType<C>` utility types

## Full-Stack Type Safety

- Shared type packages in monorepo (`packages/types/`)
- tRPC for end-to-end typed API contracts (no code-gen required)
- Prisma / Drizzle for type-safe database queries generated from schema
- Zod for runtime validation that matches TypeScript types
- GraphQL codegen (`@graphql-codegen`) for typed operations

## Build and Tooling

- `tsconfig.json`: set `moduleResolution: bundler` (TS 5+) or `node16` for Node
- Project references (`composite: true`, `references: [...]`) for monorepos
- Incremental compilation (`incremental: true`) for large codebases
- Path mapping (`paths`) for aliasing — document each alias
- Declaration bundling: `dts-bundle-generator` or `tsup` for library output
- Tree shaking: use type-only imports (`import type`) to avoid side-effect bundling

## Error Handling Patterns

- `Result<T, E>` types (or `neverthrow`) for explicit error propagation
- `never` to enforce exhaustive union handling
- Custom typed error classes: `class AppError extends Error { code: ErrorCode }`
- Zod `.safeParse()` returns `{ success: true, data }` | `{ success: false, error }` — prefer over `.parse()`

## Testing with Types

- `expectTypeOf` (vitest) or `tsd` for type-level assertions
- Type-safe fixtures with `as const` + inferred types
- Mock factories typed to match production interfaces
- `@ts-expect-error` (not `@ts-ignore`) for intentional type error tests

## Framework Patterns

| Framework | Key typing pattern |
|---|---|
| React + TS | `FC<Props>`, `useRef<HTMLElement>`, typed context |
| Next.js | `GetServerSideProps`, `Metadata`, `PageProps` generics |
| Express / Fastify | `Request<Params, Body>` generics, typed middleware |
| NestJS | Decorator metadata + class-validator for DTO typing |

## Monorepo Patterns

- Workspace config: `pnpm-workspace.yaml` or `package.json` workspaces
- Shared type-only packages: `"exports": { ".": "./dist/index.d.ts" }`
- Project references: each package has `tsconfig.build.json` + `tsconfig.json`
- CI: `tsc --build` from root to validate all packages together
- Version management: changesets for coordinated releases

## Code Generation

- OpenAPI → TS: `openapi-typescript` (type-only, no runtime overhead)
- Database schema → TS: Prisma or Drizzle schema introspection
- GraphQL → TS: `@graphql-codegen/typescript` + `typescript-operations`
- Form types: Zod schema as single source of truth; infer `z.infer<typeof schema>`

## Done / Acceptance

Change is production-ready when:
- `tsc --noEmit` exits 0 with `strict: true`
- ESLint (`@typescript-eslint`) exits with zero errors/warnings
- All public APIs have explicit types (no inferred `any`)
- Test coverage >90%; type-level tests present for complex generics
- Bundle size checked; type-only imports used where applicable
- Declaration files present and correct for library packages
