---
id: FEAT-015
status: pending
priority: P2
category: skill
target_release: v0.2.0
created: 2026-05-22
updated: 2026-05-22
depends_on: [FEAT-014]
slices: []
derived_from: FEAT-005
autonomous_safe: false
phase: 2
---

# FEAT-015: Domain skill — flutter/flutter-conventions

## Description

`skills/domain/flutter/flutter-conventions/SKILL.md` was created as part of
the FEAT-005 batch (2026-05-22). This item tracks human review of voice,
accuracy, and completeness. Content distilled from Flutter team guidance,
Riverpod/Bloc community standards, and flutter_lints conventions.

## Acceptance hints

- ≤200 lines (currently ~175).
- Frontmatter: `tier: domain`, `stack: flutter`, `triggers: ["*.dart", "flutter", "Widget"]`.
- `## When to Use` and `## Done criteria` sections present.
- `node ./scripts/validate-skills.mjs` passes with no new warnings.
- Human reviewer confirms state management recommendation (Riverpod default) matches project policy.
- Confirm approved/banned package list is up-to-date.
