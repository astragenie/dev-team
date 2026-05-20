---
description: Advanced internal coordination command for releasing claimed files after parallel work.
argument-hint: [path] [more paths]
---

# Release Files For Internal Coordination

Use this when a task is complete or when ownership should be handed off.

Workflow:

1. Run (splits `$ARGUMENTS` on whitespace into separate path args without re-evaluating shell metacharacters):
   ```bash
   set -euo pipefail
   read -ra _args <<< "$ARGUMENTS"
   node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" release --repo "$PWD" -- "${_args[@]}"
   ```
2. If no paths are provided, release all current claims.
3. Summarize:
   - released files
   - skipped files, if any

Deliverable:

- a short release update
