---
description: Advanced internal coordination command for resolving an approval gate.
argument-hint: <approval-id>
---

# Resolve Internal Approval

Use this after the dispatcher or user has made a decision on a pending approval request.

Workflow:

1. Run:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" resolve-approval --repo "$PWD" --id "$ARGUMENTS" --decision approved`
2. If the approval should be rejected or canceled instead, rerun with `--decision rejected` or `--decision canceled`.
3. Summarize:
   - approval id
   - decision
   - resolver
   - any follow-up work implied by the decision

Deliverable:

- a short approval resolution update
