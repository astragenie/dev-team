---
id: FEAT-014
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

# FEAT-014: Domain skill — dart/dart-conventions

## Description

`skills/domain/dart/dart-conventions/SKILL.md` was created as part of
the FEAT-005 batch (2026-05-22). This item tracks human review of voice,
accuracy, and completeness. No Standards doc exists for Dart — content
was distilled from Effective Dart, Dart 3 language spec, and standard
lints (`package:lints/recommended.yaml` and `package:very_good_analysis`).

## Acceptance hints

- ≤200 lines (currently ~140).
- Frontmatter: `tier: domain`, `stack: dart`, `triggers: ["*.dart", "pubspec.yaml"]`.
- `## When to Use` and `## Done criteria` sections present.
- `node ./scripts/validate-skills.mjs` passes with no new warnings.
- Human reviewer with Dart experience confirms rules are accurate.
- Consider adding a Standards doc at `Astragenie.Standards/docs/dart/` as follow-on.
