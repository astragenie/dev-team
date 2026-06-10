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
pm_customer_impact: 0.50
pm_effort_estimate: 0.35
pm_strategic_alignment: 0.55
pm_technical_risk: 0.35
pm_dependency_depth: 0.15
composite_score: 0.600
autonomous_safe: false
triage_notes: "via=pm retriage 2026-06-10 | Lower-impact filler; no weak-dim trigger; FEAT body itself frames as 'good filler when P2s blocked'. Risk band 0.35: 3 small independent items (skill section + script flag + cleanup logic); rollback per-component. autonomous_safe=false retained: --dry-run on prune-artifacts touches destructive command (safety check needs human verification), bisect skill is workflow authorship, squash-merge detection touches parallel-runner/fleet code paths (cross-tree implications). Could be split into 3 separate slices — squash-merge detection has the clearest standalone value (prevents orphan worktree branches observed in fleet). Cost analog: small bundled scripty work analog SLICE-65 $3.22 — but 3 items inflates to ~$10-15 estimated."
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
