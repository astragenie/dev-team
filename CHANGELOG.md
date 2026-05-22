# Changelog

All notable changes to the `crew` plugin are documented here. Versions follow
semver-ish for a pre-1.0 plugin: minor bumps may include behavior changes.

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
