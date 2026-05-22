# Code Conventions — crew

Adapted from `Astragenie.Standards/docs/typescript/coding-conventions.md`
for this repo's plain Node ESM (`.mjs`) surface. Where a TS-specific rule
does not apply, the underlying intent is preserved.

The lint config (`eslint.config.mjs`) enforces the mechanical parts.
This doc records the reasoning so PR reviewers can apply judgment in
cases lint cannot reach.

---

## Module shape

- **ESM only**: `import` / `export`, top-level `await` allowed. No CommonJS.
- **One responsibility per module.** When a file grows past ~400 lines
  or starts mixing two clearly separable concerns (data + render,
  collection + orchestration, etc.), split it into a sibling submodule
  directory: `foo.mjs` + `foo/<concern>.mjs`.
- **Public API lives in the top-level module** (`scripts/lib/foo.mjs`).
  Internal helpers live in `scripts/lib/foo/<concern>.mjs`. The
  top-level module either implements the public surface directly or
  re-exports from its submodules.
- **Tests colocated**: `tests/<module>.test.mjs`. Test file names
  describe behavior, not release versions.

## SOLID, adapted

| Principle | Crew idiom |
|---|---|
| **SRP** | One responsibility per module / function. A function that fetches **and** renders **and** writes is three units. |
| **OCP** | Table-driven dispatch (`COMMANDS`, `FLAG_SPEC`) so new entries add one line without modifying control flow. |
| **LSP** | Pure functions over object methods where possible. |
| **ISP** | Small option objects (`{ owner }`, `{ allowExisting }`) per function, not a kitchen-sink config blob. |
| **DIP** | Lazy `await import("./...")` inside command handlers so unrelated subsystems do not pay startup cost. See `scripts/autonomous-loop.mjs::COMMANDS`. |

## Functions

- Named functions (`function foo() {}` / `async function foo() {}`)
  over arrow assigned to const, **except** when stored in a registry
  table or passed inline — arrow there is the right idiom.
- Default to ≤ 80 lines per function. ESLint warns at 120. Beyond
  that, extract a helper.
- Default to cyclomatic complexity ≤ 12. ESLint warns at 15. Beyond
  that, table-driven dispatch or early returns are usually the fix.

## Error returns

Two shapes are accepted; pick the one that matches the call site.

- **Throw for programmer errors**: misused API, unknown command,
  missing required argument. Test asserts via `assert.rejects()`.
- **Return `{ ok, error }` for soft / best-effort failures**:
  filesystem race, missing optional binary, network blip. The caller
  decides whether to log, fall back, or escalate. The bridge layer in
  `scripts/lib/slice-linker/crew-bridge.mjs` is the reference example.

Never `process.exit(N)` from a library function. Set
`process.exitCode = N` from the entry-point script after printing.

## Constants and templates

- String templates and other large constants live in a sibling
  `<module>/templates.mjs`. Functional code never imports more than
  one template module.
- Magic numbers get named constants. `const MAX_OUTPUT_BYTES = 64 * 1024`
  is better than `64 * 1024` inline.

## Filesystem

- `await fs.readFile(path, "utf8")` for text. `await fs.readFile(path)`
  (Buffer) only for binary.
- Wrap optional reads in a `.catch(() => null)` pattern. Don't
  silently swallow other I/O errors.
- Write atomically via `writeFileIfChanged` from
  `scripts/lib/installer/util.mjs` when re-writing config-like files;
  this avoids spurious mtime churn that would re-trigger watchers.

## CLI

- Subcommand dispatch goes through a `COMMANDS` registry.
- Flag parsing goes through a `FLAG_SPEC` table.
- Help text is generated from the same tables — single source of truth.

## Tests

- One behavior per `test()`. Avoid bundling unrelated assertions.
- File-system tests use `fs.mkdtemp(path.join(os.tmpdir(), ...))` for
  isolation. Never write to the repo root from a test.
- Skip-with-reason instead of silent skip when a system dependency is
  absent (see `tests/loop-installer.test.mjs` for the
  crew-CLI-version-gated skip pattern in autonomous-loop).

## Comments

Default to no comments. Add a comment when the **why** is non-obvious:

- a hidden constraint
- a workaround for a specific bug
- behavior that would surprise a reader

Do not narrate what the code already says.
