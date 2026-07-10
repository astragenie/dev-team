# Plan — quick wins + stabilization (10 items), max-parallel waves (2026-07-10)

Executes the 10 next items across dev-team + plugins-common. Same invariants as the
prior waves: repo isolation = free parallelism; same-file-area work serializes;
every builder in its own `isolation: worktree`; orchestrator hands-off shared trees.

## Collision map (what can run parallel)

| Item | Repo | File area | Parallel group |
|---|---|---|---|
| #1 hygiene (close #152, prune wt, orphan tag) | dev-team | none (gh + git admin) | **inline** |
| #2 fresh-install zod (#185/#194) | dev-team | package.json / build / install | **A-install** |
| #3 release.yml build-before-gate | plugins-common | CI workflow | **A-release** (separate repo) |
| #4 astramem scoped-recall (#159) | dev-team | scripts/lib/memory + recall | **A-mem** |
| #5 cost-report lossy fix (#178) | dev-team | cost emitter / slice-close | **A-cost** |
| #10 chore-branch lane (#163) | dev-team | worktree-manager | **A-worktree** |
| #6 subagent deliver-before-die (#187/#174) | dev-team | SubagentStop hook + agent prompts | **B-dispatch** (serial) |
| #7 worktree-isolation enforce (#169/#154) | dev-team | dispatch + cwd guard hook | **B-dispatch** (serial) |
| #8 dup-completion guard (#162) | dev-team | dispatch idle/nudge | **B-dispatch** (serial) |
| #9 modelRouting hard-enforce (#205) | dev-team | PreToolUse hook | **B-dispatch** (serial) |

Key: items #6–#9 all touch the **dispatch/hooks machinery** and interrelate (subagent
lifecycle). They must NOT run as parallel worktrees merging to main — same files. They
form one **serial stabilization lane**, and they benefit from a shared design pass first.
Everything else (A-*) is disjoint → runs concurrently.

## Wave A — quick wins (max parallel: 5 builders + inline)

All disjoint file areas → one owner each, isolated worktrees, concurrent. Each = 1 PR, review + CI, merge independently.

| Track | Item | Work | Size |
|---|---|---|---|
| **inline** | #1 | Close #152 (fixed by #204, still open) with evidence; `git worktree prune` + remove the 9 stale worktrees; note/leave orphan `gepa-core-v0.10.0` tag | XS |
| **A-install** | #2 (#185/#194) | Fix fresh-plugin-cache crash: `crew.ts` dies on `ERR_MODULE_NOT_FOUND 'zod'` (runtime dep not installed in plugin cache). Investigate → bundle/vendor the runtime deps OR make the CLI self-install OR drop the runtime zod import. **HIGH user impact.** | M |
| **A-release** | #3 | plugins-common `release.yml`: replace the hand-maintained 2-entry build list (`plugin-std`, `astramem-client`) with **build-all-workspace-deps in topo order** before the pre-publish gate. Kills the publish-failure class hit twice this session. | S |
| **A-mem** | #4 (#159) | Adopt astramem project/agent-scoped recall (astramem-local v0.7 / plugin v0.6 shipped, #160). Wire the scoped-recall call into the recall path. | S–M |
| **A-cost** | #5 (#178) | Cost-report emitter: scope dedup to the current run so a stale/wide `currentRun` no longer rewrites historical reports into lossy stubs. | S |
| **A-worktree** | #10 (#163) | Support concurrent chore-branch worktrees alongside an active wave/slice (worktree-manager + state). Enables the parallelism the rest benefits from. | S–M |

Wave-A exit: 5 PRs merged + board clean. No inter-track collisions (verified disjoint above).

## Wave B — stabilization: subagent-lifecycle reliability (the real investment)

Items #6/#7/#8/#9 are one theme (subagent lifecycle: deliver, isolate, dedup, route) touching shared dispatch/hooks files. **autonomous_safe: false** — human-in-loop review on every PR.

**B0 — design pass (architect, read-only, 1 agent):** produce a coherent design for the subagent-lifecycle guards. Root problem observed THIS session ~8×: every dispatched builder/reviewer went idle without delivering its report; one wrote to the wrong (shared main) tree. Design:
- **deliver-before-die (#187/#174)**: a SubagentStop guard that, before the subagent's turn ends, flushes its structured deliverable + commits WIP on its branch (never leave uncommitted/broken WIP). Pre-death checkpoint at the ~65–85-tool / ~20-min danglezone.
- **worktree-isolation (#169/#154)**: assert `cwd == assigned worktree root` before any write; refuse writes to the main checkout when a worktree was assigned.
- **dup-completion (#162)**: idempotency guard so an idle-mid-task + SendMessage nudge can't fork two copies completing the same work.
- **modelRouting (#205)**: PreToolUse model-injection hook so `loop.modelRouting` is hard-enforced on the sequential path, not advisory.
Output: one design doc + a per-item slice breakdown + which are hook-file-disjoint (can parallel) vs shared (must serial).

**B-build — implement per the design (serial where files collide):**
- Sequence the SubagentStop/dispatch-touching items (#6 → #7 → #8) in ONE lane (shared files, shared context).
- #9 (PreToolUse model hook) MAY run parallel IF the design confirms it's hook-file-disjoint from #7's guard; else fold into the serial lane.
- Each: own PR, human-in-loop review (autonomous_safe: false), full CI, behavior-preserving where it isn't the fix.

Wave-B exit: subagent reliability guards shipped; the re-verification tax that dominated this session is gone.

## Dependency graph

```
Wave A (∥, disjoint):  inline#1 · A-install#2 · A-release#3(pcommon) · A-mem#4 · A-cost#5 · A-worktree#10
                                              (all independent — merge as each goes green)
Wave B (after A capacity frees):  B0 design ──▶ B-build serial(#6→#7→#8) ∥ #9-if-disjoint
```
A and B can overlap: B0 (design, read-only) can start during Wave A; B-build starts once A isn't saturating the worktree/CI budget.

## ETA (effort, not calendar)

| Wave | Tracks | Size |
|---|---|---|
| A quick wins | 5 PRs + inline, all parallel | **~half–one session** (wall-clock = slowest single PR: #2) |
| B0 design | 1 architect pass | **S** |
| B-build | 3–4 PRs, serial dispatch lane + #9 | **~one session** (harness code, careful, human-in-loop) |

Total ≈ **1.5–2 focused sessions.** Wave A lands fast + safe; Wave B is the higher-value, higher-care harness stabilization. #2 (fresh-install) + #3 (release safety) are the two to prioritize inside Wave A — both are user/release-facing.

## Gate policy
Quick-win PRs: standard review + full CI. Stabilization PRs (#6–#9, hooks/agents/dispatch):
**autonomous_safe: false → human-in-loop review**, behavior-preserving outside the fix,
full CI, no release without explicit approval. Isolated worktree per builder; the
orchestrator does not edit a shared tree while a builder is live (session lesson).
