---
description: Internal startup/debug command for inspecting the raw Crew wake-up brief for this repo.
---

# Read Engineering OS Wake-Up Brief

This is primarily internal workflow plumbing. Substantial workflows should already do this automatically; use it directly only for debugging, recovery, or explicit inspection.

If the user wants a friendly "where are we?" report, prefer `/crew:brief-me`.

Workflow:

1. First verify the current workspace path:
   - `pwd`
2. Sync remote state so the brief reflects reality, not stale local refs:
   - `git fetch --prune`
3. Then run:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" wake-up --repo "$PWD"`
3. Explicitly compare the returned `repoPath` with the current working directory.
4. If they do not match, stop and treat the wake-up brief as invalid for this run.
5. Only if they match, summarize:
   - latest run memory
   - open approvals
   - active claims
   - anything that looks stale, blocked, or currently active
6. Use that to decide whether work should stay single-session, become assisted single-session, or become a team run.
