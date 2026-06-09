---
id: FEAT-136
title: "Bug: /crew:parallel skill conflicts with guard-feat-dispatch hook allowlist"
priority: P2
status: pending
category: bug
target_release: null
autonomous_safe: true
cross_repo: null
parent_spec: null
plan: null
related: [FEAT-137]
phase: null
tags: ["stack:plugin", "concern:dx", "surface:skills"]
pm_customer_impact: 0.6
pm_demand_signal: null
pm_technical_feasibility: null
pm_scope_risk: null
pm_strategic_alignment: 0.5
pm_composite: null
updated: 2026-06-09
created: 2026-06-09
triaged_at: null
triage_notes: null
slices: []
depends_on: []
github_issue: null
github_milestone: null
github_url: null
pm_legacy_demand_signal: null
---

# FEAT-136: /crew:parallel skill conflicts with guard-feat-dispatch hook

## Problem

`commands/parallel.md` step 7 instructs the orchestrator to delegate to `agents/parallel-runner.md`:

> Delegate all remaining orchestration to `agents/parallel-runner.md`: pass the plan array, the resolved loop CLI path, and `--max-features N`.

When the orchestrator (lead) actually dispatches `Agent(subagent_type=crew:parallel-runner, ...)` on FEAT work, the consuming repo's `guard-feat-dispatch.mjs` PreToolUse hook blocks it because `crew:parallel-runner` is not in the allowlist of FEAT-ceremony specialists.

Reproduced 2026-06-09 in `loopobserver` repo while trying to parallel-dispatch FEAT-119/025/026. Hook error verbatim:

```
BLOCKED: Agent dispatch with subagent_type='crew:parallel-runner' on FEAT work (FEAT-119, FEAT-025, FEAT-026).
Override: change subagent_type to a crew or loop ceremony specialist (crew:builder, crew:lead, crew:reviewer, crew:validator, crew:deployer, crew:researcher, crew:architect, crew:uxdesigner, crew:copywriter, crew:document-writer, loop:architect, loop:document-writer, loop:pm, loop:researcher) or Explore.
```

Pivot (manual): create worktrees inline, dispatch `crew:lead` per worktree in one parallel block. Works, but the skill text still tells you the wrong path.

## Acceptance

- AC-1: Decide one of two paths and apply:
  - **Path A**: rewrite `commands/parallel.md` step 7 to dispatch `crew:lead` per worktree directly in one parallel Agent block — no parallel-runner agent involved. Embed the per-worktree slice ceremony in the skill body.
  - **Path B**: add `crew:parallel-runner` to the hook allowlist in the install script (and document it as a ceremony specialist). Cross-cuts with FEAT-137.
- AC-2: README + skill description updated to reflect the chosen path.
- AC-3: Smoke-test the chosen path by running `/crew:parallel --dry-run --max-features 2` against a test repo with the hook installed and confirming no block.
- AC-4: Decide and document fate of `agents/parallel-runner.md`: keep + un-allowlist, or remove entirely.

## Notes

- Path A is the lower-risk fix (closes the conflict without loosening enforcement).
- Path B is the simpler patch but widens what can run on FEAT work — needs principled rationale (see FEAT-137).
- Manual pivot already proven in loopobserver: create 3 worktrees + dispatch 3 `crew:lead` agents in one message → background → auto-merge. No parallel-runner needed.
