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

2. **Check the file set is disjoint from the active wave lane** before claiming.
   Claim state is shared across worktrees (#163), so an overlap with the wave
   lane is detectable here:
   ```bash
   set -euo pipefail
   read -ra _args <<< "$ARGUMENTS"
   node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" claim-check --repo "<worktreePath>" --owner quickwin-lane -- "${_args[@]}"
   ```
   Returns `{ disjoint, overlaps, available }`.
   - `disjoint: true` → all files are free; proceed to claim `available`.
   - `disjoint: false` → each `overlaps[]` entry names a file owned by the wave
     lane (`owner`). Do **not** take those onto the quick-win lane — route them
     onto the wave branch instead (or wait for release). Take only `available`.

3. **Claim the disjoint file set** for the lane, from inside the lane worktree:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" claim --repo "<worktreePath>" --owner quickwin-lane -- <available files>
   ```

4. **Do the work** in `worktreePath`. Keep it small — docs / comments / artifact
   hygiene. Anything that touches runtime code belongs on a proper slice, not
   this lane.

5. **Right-sized gates** for docs/artifact/comment-only changes: route to
   `reviewer-lite` rather than the full verifier ceremony (see S3 of the #163
   plan — the pre-push gate accepts a docs-only validation-skip record).

6. **Ship the batch** as one PR per day/wave from the lane branch — not one PR
   per one-liner.

Status check (is today's lane live?):
```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" quickwin-lane status --repo "$PWD" --json
```

Deliverable:

- the lane branch + worktree path
- the claimed (disjoint) file set, and any files bounced back to the wave lane
- a one-line note for the operator on what the lane is carrying today
