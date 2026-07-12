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
     to spawn worktrees and emit the Agent batch. This step returns the worktree path already created
     for each feature — do not re-derive or re-type that path in prose afterward.
   - In one message, invoke **N parallel Agent calls** with `subagent_type: crew:build`. See
     "Attaching to a pre-created worktree" below for the required isolation mechanism — do NOT pass
     `isolation: "worktree"` on these calls (dev-team#169 follow-up correction: that parameter always
     creates a **fresh** worktree, it does not take a path, and cannot attach to the tree `dispatch
     prepare` already created — see below for what to do instead).
   - Each `crew:build` executes: `slice start` → dispatch the routed specialist builder (`crew:fullstack-dev` /
     `crew:backend-dev` / `crew:frontend-dev` / `crew:dev-lite` per the builder routing matrix in
     `docs/routing-table.md`) → wait for PASS → dispatch `crew:reviewer` (+ stack reviewer fan-out if applicable)
     → wait for PASS → `slice complete` → `slice grade` → return result marker.
   - After all agents return, call `node <loop-cli> dispatch finalize --run-id <runId> --plan <plan-json> --repo "$PWD"`
     to merge DONE children to main and aggregate results.

### Attaching to a pre-created worktree (dev-team#169)

This is the one place in the crew dispatch-authoring docs where a peer must attach to a worktree
that already exists (the one `dispatch prepare` just created), rather than get a fresh one. The
`Agent` tool's `isolation` parameter cannot express this — it is a bare `"worktree" | "remote"`
enum with no path argument, and `"worktree"` always creates a **new**, disconnected temporary tree.
Pointing it "at" `dispatch prepare`'s path is not possible; doing so silently spins up a second tree
the merge flow in step 7's `dispatch finalize` call never sees, so the real work lands somewhere
`dispatch finalize` can't find it — strictly worse than the original #169 bug (a lost-work bug
instead of a cwd-discipline bug).

The correct mechanism: dispatch each `crew:build` Agent call with **no `isolation:` field at all**
(so it launches unpinned, at this dispatcher's own cwd), and make the FIRST instruction in that
agent's dispatch prompt an explicit directive to call the `EnterWorktree` tool itself, before any
other tool use, with `path` set to the worktree `dispatch prepare` returned for that feature:

```
Before anything else, call EnterWorktree with path: "<worktree-path-from-dispatch-prepare>" to
attach to your assigned worktree. Do this as your first tool call, before any Read/Edit/Bash.
```

This is harness-enforced by the `EnterWorktree` tool call itself (it switches that agent's actual
working directory), not by the surrounding prose — the prose only tells the agent which tool call
to make and with what argument; the cwd pin comes from the tool executing, exactly the same
distinction guard 2's fix draws everywhere else. `EnterWorktree` is a tool the dispatched subagent
calls on itself; it is not a parameter on the dispatcher's `Agent` call, and it cannot be set by the
dispatcher on the peer's behalf.

Deliverable:

- `.claude/artifacts/crew/runs/<timestamp>-parallel.md` — merged / conflicted / failed summary.
- One handoff artifact per completed worktree (written by each sub-agent's slice ceremony).
