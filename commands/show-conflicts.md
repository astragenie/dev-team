---
description: Internal/debug command for checking claim conflicts before parallel work.
argument-hint: [path] [more paths]
---

# Show Internal Claim Conflicts

Use this before assigning new work to confirm whether target files are already claimed.

Workflow:

1. Run (splits `$ARGUMENTS` on whitespace into separate path args without re-evaluating shell metacharacters):
   ```bash
   read -ra _args <<< "$ARGUMENTS"
   node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" show-conflicts --repo "$PWD" -- "${_args[@]}"
   ```
2. Treat results in three buckets:
   - `owned`: already claimed by the current session, safe to keep editing
   - `conflicts`: claimed by someone else, needs reassignment or release
   - `available`: currently unclaimed, safe to assign
3. If no paths are provided, summarize the current repo-wide claim picture.
4. Summarize whether the work is clear to proceed or needs reassignment.
