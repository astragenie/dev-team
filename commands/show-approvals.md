---
description: Internal/debug command for inspecting repo-local approval state.
argument-hint: [open|resolved|all]
---

# Show Internal Approvals

Use this to inspect which approval decisions are waiting and which have already been resolved.

Workflow:

1. Run:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" show-approvals --repo "$PWD" --status "${ARGUMENTS:-open}"`
2. Summarize:
   - open approvals
   - who they are waiting on
   - any resolved approvals if requested

Deliverable:

- a short approval status summary
