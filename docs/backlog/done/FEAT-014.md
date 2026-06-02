---
id: FEAT-014
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
github_issue: 14
github_milestone: 1
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

## Closure notes (2026-05-24)

Reviewed skill against Effective Dart + Dart 3 language features + `package:lints/recommended.yaml`. Found 2 gaps, filled in close pass:

1. New "Records (Dart 3)" section — ad-hoc multi-value returns + pattern matching destructuring + when-to-use vs sealed classes.
2. New "Extension methods" section — add behavior to third-party types without subclassing; `lib/<area>/extensions.dart` placement; do not extend `Object`/`dynamic`.

Final line count: 154/200 (was 125). validate-skills clean.

Follow-on still open: Standards doc at `Astragenie.Standards/docs/dart/` would let this skill cite a canonical source.
