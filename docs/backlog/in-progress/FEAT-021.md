---
id: FEAT-021
status: in-progress
priority: P2
category: quality
target_release: v0.4.0
created: 2026-05-23
updated: 2026-05-23
depends_on: []
slices: [SLICE-03]
derived_from: null
autonomous_safe: true
phase: 2
started_at: 2026-05-23
---
# FEAT-021: Routing-table skill-ID CI linter (validate-routing-table.mjs)

## Description

`docs/routing-table.md` cites external skill IDs like
`microsoft-docs:microsoft-code-reference`, `terraform-code-generation:azure-verified-modules`,
and local `crew:terraform-ops-traps`. FEAT-019's design promise was
"single point of rename = routing-table row heading" — if an
upstream skill renames, you change one table cell and every agent
keeps working.

That promise has **no CI enforcement** today. If
`microsoft-docs:microsoft-code-reference` becomes
`microsoft-docs:ms-code-reference` upstream, the routing-table
silently rots: agents call a dead skill name, lead dispatches with
a wrong-ID handoff, and the only signal is a runtime "skill not
found" error during an actual dispatch.

This FEAT adds a lightweight CI linter that parses the routing-
table, extracts skill IDs from the "Route to" column, and validates
each against the installed plugin cache + local `skills/` tree.

## Scope

In scope:

- New `scripts/validate-routing-table.mjs` (≤80 lines). Behavior:
  - Read `docs/routing-table.md`.
  - For each table row, extract bold-quoted skill references
    matching `\b[a-z0-9-]+:[a-z0-9-]+\b`.
  - For each ID:
    - If prefix is `crew:`, check `skills/**/SKILL.md` for matching
      `name:` field.
    - Else, check `~/.claude/plugins/installed_plugins.json` for the
      parent plugin (e.g. `microsoft-docs:*` → check
      `microsoft-docs@<marketplace>` installed). Then check the
      plugin cache (`~/.claude/plugins/cache/<mkt>/<plugin>/<ver>/skills/*/SKILL.md`)
      for the specific skill name.
    - If neither check passes, error.
  - Exit non-zero on any unresolved ID; print a list with file:line.
  - Skip silently when running in CI without plugin cache available
    (gate on `CREW_VALIDATE_ROUTING_TABLE=1` env or similar).
- Add as CI gate #9 in `.github/workflows/test.yml` (after
  `validate-skills.mjs`), guarded by the env flag so it only runs
  when cache is present.
- Add `npm run validate:routing-table` script entry.
- Local: developer runs it on demand; CI runs it in any environment
  that has the installed plugin cache mounted.

Out of scope:

- Auto-fix for renamed skills (manual edit on signal is acceptable).
- Cross-checking that the skill's *triggering description* matches
  the routing-row signal (deeper semantic check, separate FEAT).
- Validating context7 tool IDs (`context7.resolve-library-id` etc.)
  — those are MCP tools, not skills; different namespace.

## Acceptance hints

- Running `node scripts/validate-routing-table.mjs` against current
  `docs/routing-table.md` exits 0 (all IDs resolve).
- Manually renaming a skill ID in routing-table to a nonexistent
  name causes exit non-zero with a clear error message naming the
  bad ID + the row heading.
- Removing an installed plugin (e.g. uninstall hashicorp) causes
  the linter to error on any `terraform-code-generation:*` rows.
- CI gate runs in any env where `CREW_VALIDATE_ROUTING_TABLE=1` is
  set; skips gracefully otherwise.
- No false positives on context7 MCP tool references
  (`context7.resolve-library-id`).
- Lint clean; ≤80 lines; tests in
  `tests/validate-routing-table.test.mjs` cover the resolve-pass,
  resolve-fail, and skip-when-no-cache paths.

## Risks / open questions

- **Cache discovery**: `installed_plugins.json` path is OS-specific
  (`~/.claude/plugins/`). Test fixture must mock this path.
- **Marketplace name lookup**: a plugin can be installed from
  multiple marketplaces (rare). Validator picks first match.
- **Performance**: parsing routing-table + walking plugin cache is
  fast (<100ms for current scale). No optimization needed.
- **Forward pointers**: if a row cites a future skill ID that is
  intentionally not yet installed, the linter errors. Mitigation:
  support a `<!-- routing-lint:ignore -->` HTML comment on rows
  that intentionally name uninstalled skills.
