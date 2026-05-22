# Changelog

All notable changes to the `crew` plugin are documented here. Versions follow
semver-ish for a pre-1.0 plugin: minor bumps may include behavior changes.

## v0.1.17 — 2026-05-22

### Changed
- **Tooling**: ESLint 9 (flat config) + Prettier 3 added. CI now runs
  `npm ci`, `validate-manifests`, `lint`, `format:check`, `node --test`,
  `e2e-smoke` as separate gates. devDependencies pinned via
  `package-lock.json`.
- **Code style swept**: prettier --write across `scripts/**/*.mjs` and
  `tests/**/*.mjs`; no semantic changes.
- **CLI registry refactor** (`scripts/crew.mjs`):
  - 58 hand-written `if (value === "--foo") { ... }` flag branches
    collapsed into a single `FLAG_SPEC` table.
  - 30-branch command `else if` chain collapsed into a `COMMANDS`
    registry of `(ctx) => Promise<result>` handlers.
  - File size: 767 → 560 lines (-207). Same flags, same outputs,
    same error messages. Adding a new command/flag is now one entry.

### Fixed
- `scripts/lib/cost-advisor.mjs`: empty `catch {}` blocks now carry
  intent comments (ESLint `no-empty`).

## v0.1.16 — 2026-05-22

### Added
- `scripts/validate-manifests.mjs`: lightweight CI gate verifying
  `plugin.json` / `marketplace.json` / `package.json` required fields,
  semver parseability, and version-drift between the three files.
  Catches the class of regression that `marketplace.json` version drift
  already caused once.
- CI: validate-manifests step runs before tests on every push/PR.
- README: test / release / license badges.
- `/crew:adopt`: explicit step 12 instructs the lead to inspect repo
  commit conventions and recommend `/crew:install-commit-bridge` when
  a matching preset applies. Stays opt-in; never auto-installs.

### Notes (not changed)
- `.gitignore` install block intentionally does NOT ignore
  `.claude/artifacts/` — artifacts are the durable record per the
  constitution and should be committed in target repos.
- Hooks audit: `log_event.sh` and the generated `commit_bridge.sh`
  are fail-closed at the shell layer (`set -euo pipefail`),
  fail-open at the JS layer (best-effort, never blocks tool output),
  use `execFileSync` (no shell) with `escapeForJsLiteral` on all
  template substitutions. No injection surface. Minor follow-up:
  `log_event.sh` has no payload-dir rotation.
- No `package-lock.json` added: zero runtime deps (Node built-ins only).

## v0.1.15 — 2026-05-22

### Changed
- README: removed stale "legacy compatibility aliases" section that
  listed five `/crew:*` commands which no longer exist (`build-feature`,
  `investigate-bug`, `bootstrap-repo`, `init-repo`, `install-global`).
- README: added optional follow-up step recommending
  `/crew:install-commit-bridge`, replacing the dead-alias block with
  real, discoverable guidance.
- `installer.mjs::buildWelcome`: returns an `optional` array with a
  one-line hint pointing at `/crew:install-commit-bridge` after `init`
  or `bootstrap`. Bridge remains opt-in; install flow is unchanged.

## v0.1.14 — 2026-05-21

### Changed
- Plugin and marketplace `author`/`owner` updated to `shishkosv` to match
  repo owner and the companion `autonomous-loop` plugin.

### Fixed
- README local-development clone URL pointed to the legacy
  `alex-radaev/engineering-os` repo; corrected to
  `sergeymilashico/hero-crew`.
- `docs/reference-repo-plan.md` replaced hard-coded
  `/Users/aradaev/Desktop/Projects/` paths with `<reference-repos-dir>`
  placeholders.

## v0.1.13 — 2026-05-21

### Fixed
- `bootstrapRepo` / `init` now seed `.gitignore` with a marker-bracketed
  `# crew:start`/`# crew:end` block. User lines outside the block are
  preserved; the block is replaced in place on re-install. Closes the
  e2e-smoke regression and lets the CI step run as a blocking gate.

### Infrastructure
- `e2e-smoke` promoted from `continue-on-error` to blocking in CI.

## v0.1.12 — 2026-05-21

First tagged release after accumulated 0.1.0 → 0.1.12 work.

### Fixed
- `write-final-synthesis` no longer hides top-level `path` under a `synthesis`
  key when a cost-report is also emitted. Restores the documented JSON shape
  for downstream callers and tests.
- `marketplace.json` version drift: autonomous-loop entry bumped to 0.1.12 to
  match its `plugin.json`.

### Added — accumulated since 0.1.0
- Per-slice Claude session cost tracking and `cost-advise` recommender.
- `brief-me` cost diagnostics: combined cache R/W + I/O in millions, dominant
  model, preformatted I/O and Cache R/W strings, richer `autonomousLoop`
  block, cost-diagnostics table for flagged slices.
- Tool-failure flag threshold raised to `> 3`.

### Infrastructure
- CI: `node --test` + `e2e-smoke` on push/PR (GitHub Actions).
- `.gitignore` covers `node_modules/`, `.claude/logs|state|artifacts/`,
  `.claude.backup.*`, `*.tmp`.
- Docs: removed hard-coded absolute paths in favor of `<path-to-this-repo>`
  placeholders.
- README documents marketplace install commands.
