# Design: FEAT-125 — plugin-dev skills wiring into crew:reviewer

- Date: 2026-06-08
- Status: implemented (closed by SLICE-51)
- Author: lead

## Problem

`crew:reviewer` referenced `plugin-dev:plugin-validator` and `plugin-dev:skill-reviewer`
as narrative review aids in `CLAUDE.md` but routing was informal — no trigger-condition
format, no "required" language.

## Decision: Path A (route to plugin-dev agents on plugin-context detection)

Selected Path A over Path B because:
- Zero content duplication — plugin-dev skills are maintained upstream
- Formal "required dispatch" language enforces the gate; Path B local-skill copy would drift
- Reviewer already has the infrastructure to dispatch skills per routing-table

## Implementation (FEAT-017, shipped in v0.21.0)

`agents/reviewer.md` — section "Plugin- and skill-shape reviewer skills (FEAT-017)":
- `plugin-dev:plugin-validator` — required when diff touches `.claude-plugin/marketplace.json`,
  `plugin.json`, files under `agents/`, `commands/`, `hooks/`, or `.mcp.json`
- `plugin-dev:skill-reviewer` — required when diff touches any `skills/**/SKILL.md`

`docs/routing-table.md` rows:
- "Plugin shape change" → `plugin-dev:plugin-validator`
- "Skill shape change" → `plugin-dev:skill-reviewer`

## validator.md decision

`agents/validator.md` does NOT need plugin-dev skills. Validator confirms behavior
(runnable, observable). Plugin-dev skills are static-analysis checks on manifest
structure and skill quality — these belong at review time, not validation time.

## What does NOT change

- No new TypeScript code
- No new skills files (Path A avoids local copies)
- `agents/validator.md` unchanged
