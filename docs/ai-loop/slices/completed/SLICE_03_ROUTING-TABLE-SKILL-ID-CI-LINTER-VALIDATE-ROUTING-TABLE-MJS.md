---
id: SLICE-03
status: completed
feature: FEAT-021
priority: P2
target_release: v0.3.2
created: 2026-05-23
updated: 2026-05-24
completed_at: 2026-05-24
---
# SLICE-03: Routing-table skill-ID CI linter (validate-routing-table.mjs)

Implements all of FEAT-021 (single-slice feature). See [feature file](../../../backlog/in-progress/FEAT-021.md) for full rationale.

## Objective

Add a lightweight CI linter that parses `docs/routing-table.md`, extracts skill IDs from the "Route to" column, and validates each against installed plugin cache + local `skills/` tree. Defends FEAT-019's single-point-of-rename design promise.

## In scope

- New `scripts/validate-routing-table.mjs` (≤80 lines) that:
  - Parses `docs/routing-table.md` for skill IDs matching `\b[a-z0-9-]+:[a-z0-9-]+\b`.
  - For `crew:*` prefix: checks local `skills/**/SKILL.md` `name:` field.
  - For other prefixes: checks `~/.claude/plugins/installed_plugins.json` for parent plugin, then walks plugin cache for skill SKILL.md.
  - Supports `<!-- routing-lint:ignore -->` HTML comment to opt rows out of checking (forward pointers).
  - Skips silently when `CREW_VALIDATE_ROUTING_TABLE` env is unset (CI gate is opt-in).
  - Exits 0 on all-resolve OR opt-out; non-zero with per-ID error list otherwise.
- `npm run validate:routing-table` script entry in `package.json`.
- `.github/workflows/test.yml` CI gate added (guarded by env flag).
- Tests in `tests/validate-routing-table.test.mjs` covering: all-resolve pass, missing-skill fail, ignore-comment skip, no-cache skip.

## Out of scope

- Auto-fix for renamed skills.
- Triggering-description semantic check.
- Validating context7 MCP tool IDs (different namespace — bare `context7` references should be ignored or handled with a regex carve-out).
- Cross-marketplace plugin disambiguation (first-match-wins acceptable).

## Acceptance criteria

- [ ] **AC-1** `scripts/validate-routing-table.mjs` exists, ≤80 lines, ESM Node 22+.
- [ ] **AC-2** Running with `CREW_VALIDATE_ROUTING_TABLE=1` against current `docs/routing-table.md` exits 0.
- [ ] **AC-3** Renaming any skill ID to a nonexistent name causes exit non-zero with clear error naming the bad ID + row signal heading.
- [ ] **AC-4** Without `CREW_VALIDATE_ROUTING_TABLE` env set, script exits 0 immediately.
- [ ] **AC-5** Rows with `<!-- routing-lint:ignore -->` comment are skipped silently.
- [ ] **AC-6** `npm run validate:routing-table` invokes the script.
- [ ] **AC-7** `.github/workflows/test.yml` has new gate step running after `validate-skills`. Step guarded by env flag.
- [ ] **AC-8** New `tests/validate-routing-table.test.mjs` covers the 4 paths.
- [ ] **AC-9** No regressions: `npm run lint && npm run format:check && npm run typecheck && npm test && validate-manifests && validate-skills` all pass.

## Done When

- AC-1..9 PASS with evidence.
- Reviewer A verdict = pass.
- `final-synthesis` artifact written via `loop:slice-complete`.
- Slice file moved to `slices/completed/`.
- FEAT-021 auto-moves to `backlog/done/`.

## Reviewer ladder

- **Reviewer A**: `crew:reviewer` — correctness review against FEAT-021 scope + AC verification + cross-platform `~` expansion check.
- **Reviewer B**: `plugin-dev:plugin-validator` — triggered by `.github/workflows/` diff per "Plugin shape change" routing row.
