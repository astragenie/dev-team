---
id: FEAT-012
status: done
priority: P2
category: skill
target_release: v0.3.2
created: 2026-05-22
updated: 2026-05-24
completed_at: 2026-05-24
depends_on: [FEAT-005]
slices: []
derived_from: FEAT-005
autonomous_safe: false
phase: 1
github_issue: 12
github_milestone: 1
github_url: "https://github.com/sergeymilashico/hero-crew/issues/12"
---
# FEAT-012: Domain skill — javascript/js-conventions

## Description

`skills/domain/javascript/js-conventions/SKILL.md` was created as part of
the FEAT-005 batch (2026-05-22). This item tracks human review of voice,
accuracy, and completeness against `Astragenie.Standards/docs/javascript/coding-conventions.md`.

## Acceptance hints

- ≤200 lines (currently ~160).
- Frontmatter: `tier: domain`, `stack: javascript`, `triggers: ["*.mjs", "*.js"]`.
- `## When to Use` and `## Done criteria` sections present.
- `node ./scripts/validate-skills.mjs` passes with no new warnings.
- Human reviewer confirms conventions match Standards doc.

## Closure notes (2026-05-24)

Reviewed skill against `Astragenie.Standards/docs/javascript/coding-conventions.md`. Found 5 gaps — all filled in the same close pass:

1. SOLID LSP row added to skill's principle table.
2. `no-implicit-globals` ESLint rule added to skill's rules table.
3. New "CLI" section (subcommand `COMMANDS` registry + `FLAG_SPEC` table + help generated from same).
4. New "Constants and templates" section (templates module pattern + named-constant-over-magic-number).
5. New "Functions" section (≤80-line default, ≤12 cyclomatic default).

Final line count: 134 (was 114; still well under 200 cap). `validate-skills.mjs` clean (no new warnings).
