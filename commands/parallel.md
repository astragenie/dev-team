---
description: Run multiple autonomous-safe triaged features in parallel git worktrees
  using `crew:build` per-worktree dispatch (Path A, FEAT-136). Resolves loop CLI,
  spawns worktrees, dispatches N `crew:build` agents in one parallel block (each runs
  the slice ceremony), then merges DONE branches to main.
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
7. **Dispatch `crew:build` agents in parallel, one per worktree:**
   - Call `node <loop-cli> dispatch prepare --plan <plan-json> --parent-branch main --repo "$PWD" --json`
     to spawn worktrees and emit the Agent batch.
   - In one message, invoke **N parallel Agent calls** with `subagent_type: crew:build`, each with the
     per-worktree slice ceremony prompt embedded (see below).
   - Each `crew:build` executes: `slice start` → dispatch `crew:builder` → wait for PASS → dispatch `crew:reviewer`
     → wait for PASS → `slice complete` → `slice grade` → return result marker.
   - After all agents return, call `node <loop-cli> dispatch finalize --run-id <runId> --plan <plan-json> --repo "$PWD"`
     to merge DONE children to main and aggregate results.

Deliverable:

- `.claude/artifacts/crew/runs/<timestamp>-parallel.md` — merged / conflicted / failed summary.
- One handoff artifact per completed worktree (written by each sub-agent's slice ceremony).
