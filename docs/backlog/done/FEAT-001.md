---
id: FEAT-001
status: done
priority: P0
category: foundation
target_release: v0.2.0
created: 2026-05-22
updated: 2026-05-22
completed: 2026-05-22
depends_on: []
slices: []
derived_from: null
autonomous_safe: true
phase: 1
github_issue: 1
github_milestone: 1
---
# FEAT-001: Skills directory reorganization

## Description

Split `skills/` into the four-tier taxonomy defined in `docs/architecture/architecture.md`:

```
skills/
├── universal/
├── workflow/
├── domain/
└── meta/
```

Move existing skills into the correct tier without rewriting content.

## Acceptance hints

- All current skills relocated.
- No skill content rewritten in this slice.
- Each skill's frontmatter gains a `tier` field (`universal | workflow | domain | meta`).
- `.claude-plugin/plugin.json` paths still resolve (or adjusted).
- Existing tests pass unchanged.
- One follow-up note added to `docs/architecture/architecture.md` if the move uncovered a misclassification.
