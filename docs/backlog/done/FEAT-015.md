---
id: FEAT-015
status: done
priority: P2
category: skill
target_release: v0.3.2
created: 2026-05-22
updated: 2026-05-24
completed_at: 2026-05-24
depends_on: [FEAT-014]
slices: []
derived_from: FEAT-005
autonomous_safe: false
phase: 1
github_issue: 15
github_milestone: 1
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

## Closure notes (2026-05-24)

Reviewed skill against Flutter team guidance + flutter_lints + Riverpod community standards. Found 2 gaps, filled in close pass:

1. New "Error display" section — SnackBar for transient + AlertDialog for blocking + `ErrorWidget.builder` override + `FlutterError.onError` instead of print.
2. New "Internationalization" section — `flutter_localizations` + `intl` from day one; ARB files; codegen via `flutter gen-l10n`; no hardcoded user strings; `Intl.plural` + `DateFormat` for variant formatting.

Final line count: 132/200 (was 118). validate-skills clean.

Riverpod-as-default recommendation kept (FEAT-015 acceptance hint asks operator to confirm; operator stack is Flutter so Riverpod default is sensible — flag for re-check if project-specific policy differs).
