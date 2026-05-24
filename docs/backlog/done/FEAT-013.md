---
id: FEAT-013
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
phase: 2
---

# FEAT-013: Domain skill — typescript/ts-conventions

## Description

`skills/domain/typescript/ts-conventions/SKILL.md` was created as part of
the FEAT-005 batch (2026-05-22). This item tracks human review of voice,
accuracy, and completeness against `Astragenie.Standards/docs/typescript/coding-conventions.md`.

## Acceptance hints

- ≤200 lines (currently ~160).
- Frontmatter: `tier: domain`, `stack: typescript`, `triggers: ["*.ts", "*.tsx"]`.
- `## When to Use` and `## Done criteria` sections present.
- `node ./scripts/validate-skills.mjs` passes with no new warnings.
- Human reviewer confirms conventions match Standards doc.

## Closure notes (2026-05-24)

Reviewed skill against general TS strict-mode best practices (no upstream Standards doc exists for typescript — referenced source path was stale; updated to "Standalone — no upstream Standards doc yet"). Found 2 gaps, filled in close pass:

1. New "Imports" section (`import type` under `verbatimModuleSyntax: true`; no `import * as` unless library has no named exports; no deep node_modules paths).
2. New "Testing" section (vitest + @testing-library/react; co-location; one behavior per test; `vi.mock` at module boundary; `findBy*` over `getBy*` for async).

Final line count: 130/200 (was 116). validate-skills clean.
