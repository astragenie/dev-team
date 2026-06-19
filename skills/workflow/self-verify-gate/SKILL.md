---
name: self-verify-gate
prompt_id: self-verify-gate
version: 1.0.0
tier: workflow
description: Scoped pre-handoff verification procedure for builder agents. Resolve slice base, derive touched-set, run scoped typecheck/lint/affected-tests/repo-validators, write the `## Self-Verify Gates` section that `commands/orchestrate-slice.md` gates on.
owner: hero-crew
last_reviewed: 2026-06-10
triggers: ["builder / builder-fe / builder-be about to write completion handoff"]
---

# Self-verify gate

## When to use

Builder agents (`builder`, `builder-fe`, `builder-be`) MUST run this gate before writing the completion handoff. It is the fast inner loop — the validator's mandatory final gate re-runs the whole-repo lint, format check, and full test suite ONCE at the end. Here you run only the SCOPED equivalents on paths in your diff, never the whole tree.

`commands/orchestrate-slice.md` reads the `## Self-Verify Gates` section your handoff body emits and HARD-GATES on every gate showing PASS (FAIL halts the slice).

## State model

Each gate reports one of **PASS / FAIL / SKIPPED / TIMEOUT**.

- **PASS** — gate ran, zero errors.
- **FAIL** — gate ran, found failures. **Halts the builder.** Fix or escalate via `mark-badge`.
- **SKIPPED** — gate not applicable (e.g. no skills/ paths touched → skip `validate-skills.ts`). Validator picks it up.
- **TIMEOUT** — gate exceeded its hard cap (60s on typecheck). Validator picks it up on the final gate.

SKIPPED and TIMEOUT proceed; only FAIL halts.

## Procedure

### 1. Resolve slice base (once)

```bash
SLICE_BASE=$(git merge-base HEAD origin/main 2>/dev/null || git merge-base HEAD main 2>/dev/null || echo HEAD~1)
```

### 2. Derive touched-set (once, reuse for every gate)

```bash
git diff --name-only "$SLICE_BASE"
```

Scope tests + lint to this set. Do not widen it.

### 3. Run scoped gates, in order

#### Typecheck / compile (hard-cap 60s; report TIMEOUT and continue if exceeded)

The cap is configurable via `CREW_BASH_GATE_TIMEOUT_S` (default 60). Lift it for slow CI runners — never below 30 (covers tsc cold start).

- Bun / Node / TS → `timeout ${CREW_BASH_GATE_TIMEOUT_S:-60} bun run typecheck` (tsc whole-project; not cheaply scopable)
- C# / .NET → `dotnet build --nologo --no-restore <touched .csproj>` (scope to project owning touched `*.cs`; not whole solution)
- Python → `mypy <touched paths>` or `pyright <touched paths>`

#### Lint — changed paths only (whole-repo stays at validator's final gate)

- Bun / Node / TS → `bun run lint -- <touched files>`
- C# / .NET → `dotnet format --include "<touched .cs>" --verify-no-changes` (analyzers also run during `dotnet build`)
- Python → `ruff check <touched files>`

#### Affected-class tests only — do NOT run the full suite

Using the touched set, run only tests exercising changed source:

- bun test (Bun repo) → `bun test --parallel <colocated *.test.ts for each changed source file>` (`--parallel` worker mode required for full `node:test` subtest compat — see ADR-002 amendment)
- Vitest → `vitest related <changed files>` (also covers tests importing changed files)
- C# / .NET → `dotnet test <touched test project> --filter "FullyQualifiedName~<changed namespace or class>"` (scope to test project for changed source; not whole solution)
- Python → `pytest <touched test files>` (or `pytest --testmon` if installed)
- Net-new behavior with no existing test → write the failing test first per TDD policy; that new test IS its affected set.

#### Repo validators for touched paths only

Skip validators whose targets you did not touch — the validator runs `validate:all` at the end:

- Edited `agents/` → `node ./scripts/validate-agents.ts`
- Edited `skills/` → `node ./scripts/validate-skills.ts`
- Edited `.claude-plugin/marketplace.json` or `plugin.json` → `node ./scripts/validate-manifests.ts`

#### FE-specific (builder-fe only)

- Orval + openapi-msw regenerate clean (no diff in `src/api/`, `src/mocks/` against committed output)
- a11y check on changed components when `concern:accessibility` tagged (axe-core via Vitest or `@axe-core/playwright`)

#### BE-specific (builder-be only)

- Migration dry-run when DB schema changes:
  - C# → `dotnet ef migrations script --idempotent`
  - Python (Alembic) → `alembic upgrade head --sql`
- Migrations reversible: every new Up migration has a corresponding Down / rollback
- Config externalized: grep new code for hard-coded hostnames, credentials, or connection strings — zero allowed
- Metrics endpoint present when `concern:observability` applies: `/health`, `/ready`, `/metrics` routes exist

### 4. Emit the gate section in your handoff body

Your handoff body MUST include ONE `## Self-Verify Gates` section. Format: one line per gate (command + PASS/FAIL/SKIPPED/TIMEOUT + one-sentence summary), then a final `Deferred to validator:` line naming the affected test set you ran — so the validator and reviewer know the full suite + whole-repo lint/format are still pending.

Example:

```
## Self-Verify Gates
- typecheck: PASS (`bun run typecheck`, 0 errors)
- lint: PASS (`bun run lint -- scripts/lib/foo.ts`, 0 warnings)
- affected tests: PASS (`bun test --parallel tests/foo.test.ts`, 7/7)
- repo validator (validate-skills.ts): SKIPPED (no skills/ paths touched)
- Deferred to validator: full suite + whole-repo lint/format still pending; affected set was `tests/foo.test.ts`
```

## Anti-patterns

- Running whole-repo `bun run lint` or `bun test` (no args). That is the validator's job, not yours.
- Omitting the `Deferred to validator:` line. Validator + reviewer rely on it to know what is still pending.
- Reporting PASS without running the gate. The validator and orchestrate-slice cross-check; lying here forces a rebound.
- Treating TIMEOUT as FAIL. TIMEOUT is a deferral signal, not a failure.

## Cross-references

- `commands/orchestrate-slice.md` L308 — hard-gates on this section.
- `agents/validator.md` — re-runs the same gates whole-repo at the final gate.
- `agents/builder.md`, `agents/builder-fe.md`, `agents/builder-be.md` — call this skill.

## Done when

- All applicable gates have reported PASS / SKIPPED / TIMEOUT (none FAIL).
- `## Self-Verify Gates` section is written to the handoff body in the documented format.
- `Deferred to validator:` line names the affected test set so validator + reviewer know what is still pending whole-repo.
