---
name: js-conventions
prompt_id: js-conventions
version: 1.0.0
tier: domain
stack: javascript
description: JavaScript / Node ESM conventions — module shape, SOLID idioms, error handling, lint rules. Use when touching *.mjs or *.js files.
owner: sergeymilashico
last_reviewed: 2026-05-24
triggers: ["*.mjs", "*.js", "node", "javascript", "biome.json"]
---

# JavaScript / Node ESM Conventions

Source: `Astragenie.Standards/docs/javascript/coding-conventions.md`

## When to Use

Lead: recommend when a builder is touching `.mjs` / `.js` files, adding a new Node module, or reviewing JavaScript PRs.

When unsure of a library's current API surface (e.g. `vite`, `eslint`, `vitest`, `node`), call **context7 MCP** (`resolve-library-id` → `get-library-docs`) before editing. See `docs/routing-table.md` row "Library / API uncertainty".

## Module shape

- ESM only. `import` / `export`. No CommonJS unless integrating with a CJS-only edge dependency.
- One responsibility per module. Split at ~400 lines or when two concerns mix (data + render, collection + orchestration).
- Public API in the top-level module. Internal helpers in `<module>/<concern>.mjs`.
- Tests colocated as `<module>.test.mjs`. Name by behavior, not release version.

## Naming

- Source files: kebab-case (`workflow-state.mjs`).
- Constants: `UPPER_SNAKE_CASE` for compile-time; `const camelCase` for runtime.
- Named functions (`function foo()`) over `const foo = () =>` — except registry tables and inline callbacks.

## SOLID in ESM

| Principle | Application |
|---|---|
| **SRP** | One responsibility per module / function. Fetch + render + write = three units. |
| **OCP** | Table-driven dispatch (`COMMANDS`, `FLAG_SPEC`) so new entries add one line. |
| **LSP** | Prefer pure functions over object methods — substitutability is automatic. |
| **ISP** | Small option objects per function, not a kitchen-sink config blob. |
| **DIP** | Lazy `await import("./...")` inside handlers — unrelated subsystems skip startup cost. |

## Functions

- Named `function foo()` over `const foo = () =>` — except registry tables and inline callbacks.
- Default ≤80 lines per function.
- Default cyclomatic complexity ≤10 (Biome warns at 10).
- Beyond budget: extract helper, table-driven dispatch, predicate extraction, or early returns.

## Tables over chains

More than 3 string cases → table:

```js
const HANDLERS = { a: handleA, b: handleB, c: handleC };
function dispatch(kind, x) {
  const handler = HANDLERS[kind];
  if (!handler) throw new Error(`Unknown kind: ${kind}`);
  return handler(x);
}
```

## Error handling

- **Throw** for programmer errors (misused API, unknown command, missing required arg).
- **Return `{ ok, error }`** for soft / best-effort failures (filesystem race, missing optional binary).
- Never `process.exit(N)` from a library function. Set `process.exitCode = N` from the entry-point script.
- Never `catch {}` empty swallow without a comment explaining why.

```js
async function bestEffort(fn) {
  try { return await fn(); } catch (err) { return { error: err.message }; }
}
```

## Constants and templates

- String templates + large constants in sibling `<module>/templates.mjs`. Functional code imports at most one template module.
- Magic numbers → named constants. `const MAX_OUTPUT_BYTES = 64 * 1024` beats `64 * 1024` inline.

## CLI

- Subcommand dispatch through `COMMANDS` registry.
- Flag parsing through `FLAG_SPEC` table.
- Help text generated from the same tables — single source of truth.

## Filesystem

- `await fs.readFile(path, "utf8")` for text.
- Optional reads: `.catch(() => null)` — don't silently swallow real I/O errors.
- Write-atomically for config-like files to avoid spurious mtime churn.

## Lint rules (Biome)

| Rule | Setting |
|---|---|
| `noVar` | error |
| `useConst` | error |
| `noDoubleEquals` | error (ignoreNull — allows `== null`) |
| `noUnusedVariables` | warn (`_`-prefix tolerated) |
| `noExcessiveCognitiveComplexity` | warn 10 (off for tests) |

Formatter: `semi: true`, `quoteStyle: double`, `trailingCommas: none`, `lineWidth: 100`, `indentWidth: 2`, `arrowParentheses: always`.

CI gate: `bun run lint && bun run format:check && bun test --parallel` on every push.

## Tests

- One behavior per `test()`. No bundled unrelated assertions.
- Filesystem tests: `fs.mkdtemp(path.join(os.tmpdir(), "..."))` — never write to repo root.
- `node:test` + `node:assert/strict`.

## Anti-patterns

- Mega-modules (>500 lines mixing concerns).
- `if`-`else if` chains over 4 string cases without a table.
- `process.exit(N)` from library functions.
- Silent `catch {}` without a comment.
- Comments that narrate what the code does instead of why.
- Test files named after release versions (`v019-*.test.mjs`).
- Inline magic numbers.
- `// biome-ignore lint/<category>/<rule>:` without an inline reason.

## Done criteria

- No CommonJS in new modules.
- No `if/else if` chains > 3 string cases — replaced by table.
- `bun run lint` clean.
- `bun run format:check` clean.
- Every new public function has a test.
- No magic numbers — named constants used.
