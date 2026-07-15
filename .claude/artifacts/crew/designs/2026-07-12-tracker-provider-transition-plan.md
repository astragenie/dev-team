# Autonomous engineering program — v3 (tracker-SoT → DORA → auto mode → watcher)

**Date:** 2026-07-12 (v3; v1/v2 same day — v2 history in git)
**Status:** DRAFT — supersedes v2. v2's reviews (architect SOUND-WITH-CHANGES, adversarial
APPROVE-WITH-CONDITIONS) remain valid for everything they covered; v3 changes the goal, so
the tracker-SoT decision needs re-review before Phase A2 builds.
**North star:** watcher detects a bug → files an issue → auto mode picks it up → builds,
reviews, PRs, merges → DORA measures the whole loop.

## What changed from v2 (user decisions, 2026-07-12)

1. **Tracker (GitHub/Linear) is the SOURCE OF TRUTH for TASK TRACKING.** v2 said local files
   stay authoritative. Reversed. The backlog tree becomes a read-through cache.
2. **Grades + cost: local canonical, PUBLISHED to the tracker at slice close** as a
   marker-delimited summary comment. Not SoT — a lossy derived view. JSONL never moves.
3. **Goal is auto mode + DORA + a watcher-driven real-time fix loop**, not merely "stop
   writing local files."
4. **v2's Phase 5 (two-way sync) is superseded.** FEAT-204 assumed local stays SoT and
   designed conflict-resolution for two writers. With ONE source of truth there is no
   conflict to resolve: mutate the tracker, refresh the cache. Write-through, not dual-write.
   Mark FEAT-204 superseded, don't build it.
5. **CORRECTION — `syncPull`/`bootstrap` are NOT read-only.** v2 (and its architect review,
   which inherited the error from me) described them as a read-only mirror. They are not:
   `syncPull` calls `patchBody` + `fs.writeFile` on local FEAT files; `bootstrapFromGithub`
   creates them. Discovered by the R-D builder, which refused to wire them as instructed and
   built a provably read-only `checkSyncDrift()` instead (runner PR #485, tests assert
   byte+mtime identity after a drift-detecting run).

## The governing premise

**Auto mode amplifies your gates; it does not replace them.**

Today's session data, which is the evidence base for this entire plan:
- **7 agent deaths.** 5 at the end-of-task ceiling (168k–264k tokens), 2 early from unbounded
  read fan-out (~60k). Work survived every time; reports did not.
- **5 issues merged but never closed** (#392, #164, #435, #437, #439). The tracker lied about
  what was done, and nearly sent three builders at already-merged code.
- **3 defects shipped to `main`** (#224 nonexistent-API docs, #225 dev-lite false-block, and
  the auto-merge gate's own fail-open). All three caught by reviewers that RAN the code.
  A reading-only review would have passed all three.
- **3 of 4 first reviews returned NEEDS_FIX.**
- **3 investigations DELETED work** rather than adding it (R-A found #435 shipped; W-H found
  Phase 5 unnecessary; R-D found syncPull not read-only). The expensive mistake in this
  program is building, not investigating.

Every gate held today *because a human orchestrator was in the loop* — dispatching
verify-not-read reviewers, merging by hand, recovering four lost reports by grepping disk.
Auto mode removes exactly that. **Phase A exists to replace what the human was doing.**

## Phase A — auto-mode prerequisites (= the DORA event source; same work)

| # | Item | Why it blocks auto mode | State |
|---|---|---|---|
| A1 | **Drift check in CI** — scheduled `loop github drift`, alert on drift | The immune system for tracker truth. Would have caught all 5 stale issues. | **BUILT** — runner PR #485, needs review+merge |
| A2 | **Tracker = SoT for tasks** — backlog → Issues; local tree becomes read-through cache | Auto mode dispatching against a lying tracker burns budget on phantom work, unsupervised | design + build |
| A3 | **Dispatch size gate, 200k** — `PreToolUse` hook, warn→block, `dispatch-size-gate` flag | 7 deaths. Unattended, this is a death loop. Also the **cost governor**. | specced (architect); build |
| A4 | **Report-to-PR** — draft-PR-first, report before the risky tail | Auto mode cannot grep disk for a lost report the way a human did today | W-A in flight (#227) |
| A5 | **Verify-not-read review as the enforced default** — reviewers RUN the thing | The only reason 3 defects didn't ship. Must survive the human leaving. | policy + reviewer prompts |

### A2 design — tracker as SoT
- **Entities:** FEAT → Issue. SLICE → sub-issue (`parentId`; LinearProvider already supports).
  `status` → issue state. `priority`/`tags` → labels. `depends_on` → issue links. `pm_*` +
  `composite_score` → body block (Linear: custom fields).
- **Write-through:** mutate the issue, then refresh the local cache. No merge logic — one truth.
- **Local cache** = read-through, disposable, rebuildable from the tracker.
- **THE TRADE-OFF, STATED PLAINLY:** task operations become **network-dependent**. Today the
  loop runs fully offline under NoopProvider. Under A2, offline = read the cache, **refuse to
  mutate status** (mutating offline reintroduces dual-write drift, which is the disease).
  Builds/tests/reviews still work offline; only task-state transitions block.
- **Migration:** 168 existing FEAT/SLICE files → Issues, idempotently (`bootstrap` already
  does most of this — but see the correction above: it WRITES locally, so audit before reuse).

## Phase B — DORA

Head start: runner **#427** is literally *"`runner:close` pr.merged emit is instruction-driven —
code-enforce the DORA merge signal."* Instruction-driven means it depends on an agent
remembering, which today's data says is a coin flip. Code-enforce it.

Once Phase A lands, all four metrics derive from tracker/PR data for free:

| Metric | Source |
|---|---|
| Deployment frequency | merge + release events |
| Lead time for changes | issue created → PR merged |
| Change failure rate | `needs-fix` label + revert/hotfix rate (**today: 3 of 4** — a real number, and uncomfortable) |
| MTTR | watcher-filed bug → fix merged |

Grades + cost publish alongside as slice-close comments (local stays canonical).

## Phase C — auto mode, SUPERVISED FIRST

Do **not** go straight to unattended.

1. **C1 — auto-dispatch + human merge.** The loop picks work, builds, reviews, and **stops at
   the merge gate**. #230's sensitivity gate already enforces this for `hooks/`/`agents/`/
   `commands/`; extend the discipline. Run one full cycle this way.
2. **C2 — watch change-failure-rate for a week.** If reviews keep catching real defects at
   today's rate, **you are not ready to remove the human**. If it falls, loosen.
3. **C3 — unattended**, with a cost cap and the A3 size gate as the governor.

**Cost reality:** loop telemetry shows **~$2.4k/iteration**. Auto mode without A3 + caps is an
unattended burn, not just a quality risk.

## Phase D — watcher → real-time fix loop (the payoff)

Closer than it looks: runner's **FEAT-245 / IssueBroker** is ALREADY a cross-repo, idempotent
issue FILER for a watcher that detects problems in other repos.

Loop: **watcher detects → files issue → auto mode picks it up → build/review → PR → merge →
DORA MTTR measures it.**

Requires Phase A's tracker truth (an auto-mode consumer of a lying tracker is worse than no
watcher at all), which is why this is last, not first.

## Invariants (v3)

1. **One writer, one truth, per artifact.** Tasks → tracker. Narrative → PR/issue comments.
   Telemetry (grades, cost, trajectories, all JSONL) → **local, always**. No dual-write anywhere.
2. **Grades/cost publish is a lossy derived view.** `brief-me`/cost-advise keep reading local
   files — 218 cost + 84 grade files served over an API would be N calls, rate-limited, and
   offline-broken.
3. **Write-class fail modes** (`failMode.{lifecycle,report,gate}`), explicit at every call site:
   lifecycle = soft-fail (never blocks a build); report = loud-fail + disk fallback + a
   `SubagentStop`-hook liveness check surfacing a durable `blocked` badge; gate = hard fail-closed.
4. Draft-PR-first → report before the risky tail → `SendMessage` as backstop.
5. Sensitive paths (`hooks/`, `agents/`, `commands/`, workflows) never auto-merge (#230).
6. Reviewers **run** the thing. Reading-only review is not review.
7. Investigate before building. Three of today's slices deleted work by looking first.

## Sequence

```
A1 (built) ─┐
A3 size gate├─→ A2 tracker-SoT ─→ B DORA ─→ C1 supervised auto ─→ C2 watch CFR ─→ C3 unattended ─→ D watcher
A4 (in flight)┘
A5 policy ──┘
```
A1/A3/A4/A5 are parallel-safe and independent. A2 is the hinge. Everything after is serial.

## Open decisions for the user

1. **Accept A2's offline trade-off** (task-state mutations require the network)?
2. **Re-review needed:** the tracker-SoT reversal invalidates v2's premise; architect +
   adversarial should re-gate A2 before it builds.
3. **FEAT-204** → mark superseded (no conflict model needed under single-SoT).
4. Merge runner **#485** (drift) and close the 5 stale issues — cheap, immediate, high value.
