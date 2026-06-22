---
description: Advanced internal coordination command for claiming files during true parallel ownership.
argument-hint: <path> [more paths]
---

# Claim Files For Internal Coordination

Use this when you want to reserve specific files for the current run before editing them.

Workflow:

1. Run (splits `$ARGUMENTS` on whitespace into separate path args without re-evaluating shell metacharacters):
   ```bash
   set -euo pipefail
   read -ra _args <<< "$ARGUMENTS"
   node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" claim --repo "$PWD" -- "${_args[@]}"
   ```
2. Treat successful claims as the current owned scope.
3. If a conflict is reported, do not edit those files until ownership is clarified.
4. Summarize:
   - newly claimed files
   - already-owned files
   - conflicts, if any

Deliverable:

- a short ownership update for the user or dispatcher
