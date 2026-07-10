---
description: Spawn or reuse a concurrent quick-win chore-branch worktree, disjoint from the active wave/slice, and claim files for it.
argument-hint: [file paths to work on]
---

# Quick-Win Parallel Lane

Cut small wins (doc drift, stale comments, dead pins, artifact hygiene) onto a
dedicated `chore/quickwins-<date>` worktree that commits, PRs, and merges
**independently of the active wave/slice branch** — instead of piling them onto
it and creating one fat PR with review scope creep (#163).

The lane is **date-keyed and reused**: every quick win harvested on the same day
lands on the same branch and ships as one PR (batching — issue ask #4).

Workflow:

1. **Spawn or reuse today's lane** (idempotent — safe to run repeatedly):
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" quickwin-lane spawn --repo "$PWD" --json
   ```
   Returns `{ branch, worktreePath, base, reused }`. `reused: true` means today's
   lane already existed and you're joining it. Work happens in `worktreePath`.

2. **Claim the file set for the lane** before editing, from inside the lane
   worktree, so a concurrent wave builder can detect the overlap (claim state is
   shared across worktrees — #163):
   ```bash
   set -euo pipefail
   read -ra _args <<< "$ARGUMENTS"
   node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" claim --repo "<worktreePath>" --owner quickwin-lane -- "${_args[@]}"
   ```
   - If a **conflict** is reported, the file is owned by the active wave lane —
     do **not** take it onto the quick-win lane. Route it onto the wave branch
     instead (or wait for release).
   - Only proceed with files that claimed cleanly (disjoint from the wave).

3. **Do the work** in `worktreePath`. Keep it small — docs / comments / artifact
   hygiene. Anything that touches runtime code belongs on a proper slice, not
   this lane.

4. **Right-sized gates** for docs/artifact/comment-only changes: route to
   `reviewer-lite` rather than the full verifier ceremony (see S3 of the #163
   plan — the pre-push gate accepts a docs-only validation-skip record).

5. **Ship the batch** as one PR per day/wave from the lane branch — not one PR
   per one-liner.

Status check (is today's lane live?):
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" quickwin-lane status --repo "$PWD" --json
```

Deliverable:

- the lane branch + worktree path
- the claimed (disjoint) file set, and any files bounced back to the wave lane
- a one-line note for the operator on what the lane is carrying today
