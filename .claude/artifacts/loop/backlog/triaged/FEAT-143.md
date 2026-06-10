---
id: FEAT-143
status: triaged
priority: P3
category: ci/maintenance
target_release: null
created: 2026-06-10
updated: 2026-06-10
depends_on: []
slices: []
derived_from: null
pm_customer_impact: 0.55
pm_effort_estimate: 0.35
pm_strategic_alignment: 0.65
pm_technical_risk: 0.35
pm_dependency_depth: 0.15
composite_score: 0.625
autonomous_safe: false
triage_notes: via=pm | Lower impact/effort; multiple skill+command edits => human review; good filler when P2s blocked
---
# FEAT-143: Workflow smalls — git-bisect procedure, squash-merge detection, --dry-run convention

## Description

Three small, independent workflow hardening items bundled as one slice:

1. **Git-bisect procedure** in `skills/workflow/systematic-debugging/`:
   for "regression, unknown commit" cases in `/crew:fix` — auto-detect the
   project test command, run `git bisect` with it, handle flaky tests via
   retry-before-verdict. Source: `git-workflow/git-bisect-helper.md`.
2. **Squash-merge detection** in worktree/branch cleanup (parallel-runner,
   crew fleet): a branch whose `git diff main...branch --stat` is empty is
   merged even when `git branch --merged` misses it (squash-merge PRs).
   Prevents orphaned worktree branches. Source:
   `git-workflow/worktree-cleanup.md`.
3. **--dry-run convention** for destructive crew commands, starting with
   `crew:prune-artifacts`: print what would be deleted + summary, require
   the flag's absence for actual deletion. Source: standard pattern across
   claude-code-templates orchestration commands.

## Deliverables

- systematic-debugging skill section (bisect).
- parallel-runner / fleet cleanup logic + test.
- prune-artifacts `--dry-run` flag + test.
