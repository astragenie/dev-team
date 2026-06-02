---
id: FEAT-003
status: done
priority: P0
category: foundation
target_release: v0.2.0
created: 2026-05-22
updated: 2026-05-22
completed: 2026-05-22
depends_on: [FEAT-001, FEAT-002]
slices: []
derived_from: null
autonomous_safe: false
phase: 1
github_issue: 3
github_milestone: 1
---
# FEAT-003: Lead agent prompt update

## Description

Rewrite `agents/lead.md` to:

1. Reference `docs/routing-table.md` as the routing source of truth.
2. Reference the skill-tier conventions in `docs/architecture/architecture.md`.
3. Document the composition formula
   `role + universal + workflow + domain + repo + task`.
4. Stay **≤200 lines**. Push specifics into skills.

## Acceptance hints

- Lead prompt ≤200 lines.
- Existing crew workflow gates (review/validate/deploy) remain intact.
- No regression in the existing 35 hero-crew tests.
- A short before/after diff appears in the slice handoff so the change is reviewable.

## Why not autonomous-safe

Editing the lead's own prompt is creative + behavior-shaping work; needs
explicit human review.
