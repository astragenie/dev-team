---
description: Advanced internal coordination command for opening an approval gate on risky or blocked work.
argument-hint: <short summary>
---

# Request Internal Approval

Use this when the current task needs a decision before continuing.

Typical examples:

- scope needs to expand beyond the assignment
- a file claim must be overridden
- the change is destructive or wide-reaching
- the work needs a user-facing policy or architecture decision

Default routing:

- `scope_change` and `claim_override` go to `lead`
- `destructive_action`, `wide_scope_change`, `policy_change`, and `architecture_decision` go to `user`

Workflow:

1. Run:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" request-approval --repo "$PWD" --summary "$ARGUMENTS"`
2. Summarize:
   - approval id
   - requester
   - approver
   - why the decision is needed now

Deliverable:

- a short approval request update
