---
id: FEAT-013
status: pending
priority: P2
category: skill
target_release: v0.2.0
created: 2026-05-22
updated: 2026-05-22
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
