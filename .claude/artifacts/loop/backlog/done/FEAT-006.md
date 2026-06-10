---
id: FEAT-006
status: done
priority: P1
category: workflow
target_release: v0.2.0
created: 2026-05-22
updated: 2026-05-22
completed: 2026-05-22
depends_on: []
slices: []
derived_from: null
autonomous_safe: true
phase: 1
github_issue: 6
github_milestone: 1
github_url: "https://github.com/sergeymilashico/hero-crew/issues/6"
---
# FEAT-006: workflow-state — blocked + escalated_to_human badges

## Description

Extend `scripts/lib/workflow-state.mjs` to accept two new badges:

- `blocked` (requires `--note <reason>` and optional
  `--blocked-by <artifact-id>`)
- `escalated_to_human` (requires `--note <reason>`)

Update `summarizeWorkflowState`, `summarizeMissingArtifactWritesForRun`,
and the `mark-badge` CLI accordingly.

## Acceptance hints

- `BADGE_TABLE` gets two new entries; `applyBadge` handles them.
- Pending-badge summary surfaces `blocked` so brief-me users see it.
- Tests cover: setting blocked + reason persists; clearing blocked via
  another badge transition works; final-synthesis is permitted only
  when not in `escalated_to_human` state without explicit override.
- CLI help text updated.
