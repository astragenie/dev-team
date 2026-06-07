---
description: Internal/debug command for inspecting current file-claim state.
---

# Show Internal Claims

Use this to inspect current claimed ownership before assigning or editing work.

Workflow:

1. Run:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" show-claims --repo "$PWD"`
2. Report the current claims in a compact form:
   - file path
   - owner
   - created time

Deliverable:

- a short claims table or summary
