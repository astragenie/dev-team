# Plan — stabilization waves, max parallelism (2026-07-12)

Executes the top-10 stabilization list (2026-07-12 session) across dev-team +
runner-plugin. **Priorities: item #10 (memory wiring pair) and item #1
(fresh-install CLI crash) — both land in Wave 1.** Same invariants as the
2026-07-10 plan: repo isolation = free parallelism; same-file-area work
serializes; every builder in its own `isolation: worktree`; orchestrator never
edits a shared tree while a builder is live.

Context since the 2026-07-10 plan: #163 chore lane shipped (#216); model
routing disabled repo-wide (dev-team v0.62.1, runner v0.71.0) — old item #9
(#205 hard-enforce) is MOOT and closes as hygiene, not work.

## Collision map

| Item | Repo | File area | Group |
|---|---|---|---|
| W1-a fresh-install fix (#185/#194) | dev-team | package.json / crew.ts deps / install path | **W1** parallel |
| W1-b CLI-under-node fix (#389) | runner | package deps / .mjs import resolution / CLI entry | **W1** parallel (own repo) |
| W1-c scoped recall (#159) | dev-team | scripts/lib/memory/ + recall-block | **W1** parallel |
| W1-d capture-at-close (#394) | runner | new SubagentStop hook + hooks manifest | **W1** parallel (own repo) |
| W1-e hygiene (inline) | both | gh admin + `typecheck-errors.txt` rm | **W1** inline |
| W2-a git-anchored completion (#392) | runner | slice-linker/start-slice + backlog state | **W2** parallel |
| W2-b slice-size cap (#393) | runner | triage / decompose (pm path) | **W2** parallel — verify no backlog-writer overlap with W2-a before dispatch; else serialize after it |
| W2-c reviewer unblock (#404) | runner | hooks/guard-feat-dispatch.mjs | **W2** parallel — hooks-manifest merge-order after W1-d |
| W2-d cost-report lossy fix (#178) | dev-team | cost emitter / slice-close | **W2** parallel |
| W3 dispatch lane (#187/#174 → #169/#164 → #162) | dev-team | SubagentStop + dispatch + cwd-guard hooks, agent prompts | **W3 SERIAL**, design-first, human-in-loop |

Collision notes:
- W1-a vs W1-c share only `package.json` risk (if recall wiring adds a dep).
  Rule: W1-c must NOT touch package.json; if it needs a dep, it blocks on W1-a
  merge and rebases.
- W1-d and W2-c both touch the runner hooks manifest → W2-c dispatches only
  after W1-d merges (file-level, not wave-level, dependency).
- W3 owns dev-team hooks/dispatch exclusively — no other dev-team hook work
  runs while the lane is open.

## Wave 1 — priorities (4 builders ∥ + inline)

| Track | Item | Work | Size |
|---|---|---|---|
| **W1-a** | #185/#194 | Fresh plugin cache: `crew.ts` dies `ERR_MODULE_NOT_FOUND 'zod'`. Decide: vendor/bundle runtime deps, self-install on first run, or drop runtime zod. Must prove: clean `claude plugin install` → `crew wake-up` works. **Highest user impact — v0.62.1 installs pull the broken state today.** | M |
| **W1-b** | #389 | Same class in runner: deps not shipped + 478 `.mjs` specifiers resolve only under bun. Reuse W1-a's chosen pattern where portable. Prove: fresh install → `runner:status` works under node. | M |
| **W1-c** | #159 | Wire astramem project/agent-scoped recall (upstream v0.7/plugin v0.6 shipped, #160) into the recall path (`scripts/lib/memory/` + recall-block). No package.json edits (see collision note). | S–M |
| **W1-d** | #394 | Runner SubagentStop/session-end hook → `capture-at-close` (astramem-local `capture claude`) — fixes ingest starvation feeding the learning loop. | S–M |
| **inline** | hygiene | Close dev-team #205 + downgrade runner #440 (model routing disabled → moot until re-enable, cite v0.62.1/v0.71.0); `git rm` runner `typecheck-errors.txt`; `git worktree prune` both repos. | XS |

W1-a and W1-b coordinate on the pattern (one design note, two implementations) but
merge independently. Wave-1 exit: 4 PRs merged, hygiene done.

## Wave 2 — cost-of-failure reducers (4 builders ∥)

| Track | Item | Work | Size |
|---|---|---|---|
| **W2-a** | #392 | `runner:start` re-dispatches shipped slices — add git-anchored / per-slice completion tracking so backlog state cannot drift from git reality. | M |
| **W2-b** | #393 | Triage/decompose caps slice size (~2 pts / ~200k tokens) + pre-splits flagged landmines — prevents mid-dispatch deaths at the source. | S |
| **W2-c** | #404 | guard-feat-dispatch: allow read-only reviewers (architect-/csharp-/typescript-reviewer) on FEAT-tagged prompts — review gate currently blocks itself. Dispatch after W1-d merges. | S |
| **W2-d** | #178 | Cost-report emitter: scope dedup to current run; stale/wide `currentRun` must never rewrite historical reports into stubs. | S |

Wave 2 may start as soon as Wave-1 capacity frees (only ordering edge: W2-c after W1-d).

## Wave 3 — subagent-lifecycle serial lane (dev-team, human-in-loop)

Unchanged theme from the 2026-07-10 plan (items were #6/#7/#8 there), minus the
now-moot model-routing hook. `autonomous_safe: false` — human review on every PR.

1. **B0 design pass** (architect, read-only): one coherent design for the three
   guards; identifies any hook-file-disjoint item that can parallelize.
2. **#187/#174 deliver-before-die**: SubagentStop guard flushes structured
   deliverable + commits WIP on the agent's branch before death; checkpoint at
   the ~65–85-tool / ~20-min danger zone.
3. **#169/#164 worktree-isolation**: assert `cwd == assigned worktree root`
   before any write; fix pre-push-verifier's worktree-blind cwd scan.
4. **#162 dup-completion**: idempotency guard so idle + SendMessage nudge can't
   fork two copies of the same task.

B0 may run during Wave 1 (read-only). Build steps are strictly serial (shared
files, shared context).

## Dependency graph

```
Wave 1 (∥): W1-a · W1-b · W1-c · W1-d · inline-hygiene      ← priorities land here
                     │ (hooks-manifest order)
Wave 2 (∥): W2-a · W2-b · W2-c(after W1-d) · W2-d
Wave 3 (serial): B0 design(∥ with W1) → #187/#174 → #169/#164 → #162
```

## ETA (effort, not calendar)

| Wave | Tracks | Size |
|---|---|---|
| 1 | 4 PRs ∥ + inline | ~half session (wall-clock = slower of W1-a/W1-b) |
| 2 | 4 PRs ∥ | ~half session |
| 3 | design + 3 serial PRs | ~one session (harness code, careful) |

Total ≈ **1.5–2 focused sessions**, waves 1+2 mostly overlapping.

## Gate policy

Wave 1–2 PRs: standard review + full CI, merge-on-green. Wave 3 PRs
(hooks/dispatch): human-in-loop review, behavior-preserving outside the fix,
full CI. Isolated worktree per builder. No release mid-wave; cut one release
per repo after Wave 2 exit and again after Wave 3 exit.
