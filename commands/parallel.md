---
description: Run multiple autonomous-safe triaged features in parallel git worktrees.
  One agent per feature; auto-merges clean branches to main.
---

# Parallel Feature Execution

Dispatch isolated git worktrees for each autonomous-safe triaged FEAT, run the full
loop slice ceremony in each, and merge clean results back to main.

Flags:

- `--max-features N` — cap the number of parallel worktrees (default: `costStopThreshold`
  from `.claude/loop.json`, or 5 if unset).
- `--dry-run` — show the feature plan and projected cost without creating worktrees.
- `--repo <path>` — repository root (default: current working directory).

Workflow:

1. Verify workspace: `pwd` and confirm `git status` is clean on main.
2. Resolve the loop CLI path:
   - Check if `LOOP_ROOT` env var is set; use `${LOOP_ROOT}/scripts/loop.mjs`.
   - Otherwise read `~/.claude/plugins/installed_plugins.json` to find the `loop` plugin version
     and construct the path: `~/.claude/plugins/cache/loop/loop/<version>/scripts/loop.mjs`.
3. Read plans:
   ```
   node <loop-cli-path> auto --dry-run --repo "$PWD" --max-features N
   ```
4. Display the plan list (featureId, priority, builderPrompt preview).
5. Calculate projected cost: N × ~$40 at current opus rates. Show before proceeding.
6. If `--dry-run` is set, stop here and report the plan.
7. Delegate all remaining orchestration to `agents/parallel-runner.md`:
   pass the plan array, the resolved loop CLI path, and `--max-features N`.

Deliverable:

- `.claude/artifacts/crew/runs/<timestamp>-parallel.md` — merged / conflicted / failed summary.
- One handoff artifact per completed worktree (written by each sub-agent's slice ceremony).
