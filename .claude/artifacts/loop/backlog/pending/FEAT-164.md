---
id: FEAT-164
status: pending
priority: P2
category: bugfix
target_release: null
created: 2026-06-14
depends_on: []
slices: []
derived_from: null
tags: [crew-parallel, worktree, cleanup, dx, windows]
---

# FEAT-164: `/crew:parallel` leaves orphan worktrees + branches after merge — no auto-cleanup

## Description

`/crew:parallel` spawns N sibling worktrees under `.claude/worktrees/<slug>/`, dispatches a `crew:lead` agent per worktree, then merges DONE branches back to main. **It does not clean up the worktrees, branches, or supporting infrastructure when the work lands.**

### Observed failure (loopobserver, 2026-06-13 → 2026-06-14)

After ~22 parallel waves over a 24h period, the host repo accumulated:

- **22 worktree directories** under `.claude/worktrees/` (~5 GB on disk; each carries a full `node_modules/` + `bin/` + `obj/`)
- **22 stale branches** (all squash-merged into `main`, leaving each branch's last commit a docs-only handoff that never made it onto `main`)
- **5 orphan handoff artifacts** (`SLICE-NNN-handoff.md`, `SLICE-170-handoff.md`, etc.) that exist only on the worktree branches — not on `main`. Recovery required manual cherry-pick.
- **1 useful test-infra fix** (`IApiMarker.cs` + `IntegrationFixture<IApiMarker>` swap on `wave-1/feat-163b-tenancy`) that resolved a real `WebApplicationFactory<Program>` ambiguity bug — also never reached `main`. Recovery required manual diff + copy + commit.

Manual cleanup cost:
- 1 session (~30 min, ~$1.50) to audit, diff, cherry-pick, and prune
- 4 worktree dirs **still stuck** because VS Code's TS / Tailwind language servers hold `node_modules/@tailwindcss/oxide-win32-x64-msvc/tailwindcss-oxide.win32-x64-msvc.node` mmap'd. `rm -rf` returns `Access denied` on Windows until VS Code is restarted.

### Root cause hypotheses (need investigation)

1. **No teardown phase in `/crew:parallel`** — the orchestrator merges then exits. No `git worktree remove --force` / `git branch -d` per merged worker.
2. **No artifact-roll-forward** — `crew:lead` writes the slice's final handoff under the worktree's `.claude/artifacts/crew/handoffs/`. On squash-merge those files get squashed away, so the handoff lives only on the worker branch tip. Loop ceremony assumes the handoff is on `main`.
3. **No detection of useful uncommitted WIP** — if a `crew:lead` self-verify loop writes a fix but the final synthesis crashes mid-write, the fix sits as `?? working-tree` files on the worker branch. Without teardown audit, those files vanish when the worktree is later removed.

### Why this matters

- **Disk pressure** — each worktree is 100–400 MB (Win + node_modules). 20+ accumulate fast.
- **Branch sprawl** — `git branch` lists become unreadable. Hooks that iterate branches slow down.
- **Lost work** — useful incidental fixes captured during a slice (test-infra, gitignore, handoff docs) don't reach `main` unless the operator manually inspects every worker branch before deletion.
- **Windows handle-leak amplifier** — on Windows the longer worktrees sit, the more chance a long-lived language server (VS Code, JetBrains) attaches to their `node_modules`, blocking later cleanup.

## Acceptance hints

### Scope

- Audit `/crew:parallel` skill + supporting CLI for the existing merge-back path. Identify where teardown SHOULD hook in.
- After successful merge of a worker's branch to main, the orchestrator MUST:
  1. **Inventory the worker branch BEFORE remove** — log:
     - Any files present on the worker branch but not on `main` (paths + 1-line stat)
     - Any uncommitted WIP in the worker worktree (`git status --short`)
     - Surface this to the operator with `keep | cherry-pick | discard` choice (or auto-cherry-pick when path is under `.claude/artifacts/crew/handoffs/`)
  2. **Remove worktree** — `git worktree remove --force <path>` followed by directory rmdir; on Windows, attempt rmdir twice and warn loudly if a handle-leak blocks the second attempt (suggest restart of VS Code / TS server).
  3. **Delete branch** — `git branch -D <worker-branch>` after worktree removal succeeds.
  4. **Prune metadata** — `git worktree prune` regardless of rmdir outcome (so the worker is at least invisible to `git worktree list`).
- On worker FAILURE (`crew:lead` returns `BLOCKED` or `escalated_to_human`), do NOT auto-delete. Leave worktree + branch in place + emit a `worker-failed` artifact pointing the operator at the worktree path + last DEC log.

### Out of scope

- The Windows handle-leak itself (that's a VS Code / Tailwind upstream issue). Just detect it and surface a useful hint.
- Worktree pre-creation hygiene (this FEAT is about post-merge cleanup).

### Acceptance criteria (Given-When-Then sketch — needs spec-writer pass)

- **AC-1:** Given `/crew:parallel` dispatches 3 workers that all PASS and merge cleanly, when the orchestrator returns, then `git worktree list` shows only `main` and `git branch | grep <worker-prefix>` returns empty.
- **AC-2:** Given a worker branch has a file at `.claude/artifacts/crew/handoffs/SLICE-NN-handoff.md` not present on `main`, when the orchestrator merges and tears down, then that file is auto-cherry-picked onto `main` in a separate commit titled `docs(handoff): SLICE-NN — recovered from worker branch`.
- **AC-3:** Given a worker worktree has uncommitted WIP at remove time, when teardown runs, then the operator sees a structured summary (file paths + stat) and a `keep | discard` prompt (default: keep — never silently discard).
- **AC-4:** Given a worker worktree's rmdir fails (handle leak), when teardown runs, then `git worktree prune` still runs (metadata cleaned), the orphan dir is logged with explanation + suggested fix, and the orchestrator does NOT block subsequent worker teardowns.
- **AC-5:** Given a worker returned `BLOCKED`, when teardown runs, then the worktree + branch are preserved and a `worker-failed-N.md` artifact records the cause.

### Evidence required

- Repro recipe (clone loopobserver, run `/crew:parallel` 5 times in quick succession on different FEATs, count leftover worktrees → must be 0)
- Cross-platform behavior note for Windows handle-leak detection
