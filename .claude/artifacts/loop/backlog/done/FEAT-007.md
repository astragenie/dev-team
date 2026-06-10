---
id: FEAT-007
status: done
priority: P1
category: governance
target_release: v0.2.0
created: 2026-05-22
updated: 2026-05-22
completed: 2026-05-22
depends_on: [FEAT-001]
slices: []
derived_from: null
autonomous_safe: true
phase: 1
github_issue: 7
github_milestone: 1
github_url: "https://github.com/sergeymilashico/hero-crew/issues/7"
---
# FEAT-007: Skill quality bar + frontmatter convention

## Description

Define the minimum frontmatter every skill carries:

```yaml
---
name: <kebab-case>
description: <one-line summary used for skill discovery>
tier: universal | workflow | domain | meta
owner: <github handle or team>
last_reviewed: YYYY-MM-DD
triggers: [glob, signal, keyword...]
stack: <optional — only for domain skills>
---
```

Document the four quality gates in `docs/architecture/architecture.md`:

1. ≤200 lines
2. Trigger conditions section
3. Action steps section
4. Done criteria section + one concrete example

Add a lint helper (`scripts/validate-skills.mjs`) that fails CI if any
skill in `skills/` violates the bar.

## Acceptance hints

- Validator runs in CI before tests.
- All existing skills brought up to spec or grandfathered with a tracked
  exception list in `docs/skill-exceptions.md`.
