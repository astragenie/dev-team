# Workflow Badge Catalog

Generated from the `BADGE_TABLE` map in `scripts/lib/workflow-state.ts`, the
single source of truth for workflow badges. Each row is a badge name accepted
by `node scripts/crew.ts mark-badge --badge <name>`, the gate it writes, and
any badge-specific flags. `--note <text>` is accepted by every badge (stored
on the gate entry); `--blocked-by <artifact-id>` only affects `blocked`.

`node ./scripts/validate-badges.ts` (CI gate) fails if this table drifts from
`BADGE_TABLE` or from the CLI's `mark-badge` help/accept text — see FEAT-181.

| Badge | Meaning | Handler (gate) | Flags |
|---|---|---|---|
| `review_required` | Review gate is pending. | `gates.review` → `required` | `--note` |
| `review_passed` | Review gate passed. | `gates.review` → `passed` | `--note` |
| `review_failed` | Review gate failed; change needs fixes. | `gates.review` → `failed` | `--note` |
| `review_skipped` | Review gate explicitly skipped (with a stated reason). | `gates.review` → `skipped` | `--note` |
| `validation_expected` | Validation gate is pending. | `gates.validation` → `expected` | `--note` |
| `validation_passed` | Validation gate passed. | `gates.validation` → `passed` | `--note` |
| `validation_failed` | Validation gate failed. | `gates.validation` → `failed` | `--note` |
| `validation_skipped` | Validation gate explicitly skipped (with a stated reason). | `gates.validation` → `skipped` | `--note` |
| `validation_stale` | Prior validation result is stale and needs re-running. | `gates.validation` → `stale` | `--note` |
| `dev_deploy_expected` | Dev deployment evidence is pending. | `gates.deployment.dev` → `expected` | `--note` |
| `dev_checked` | Dev deployment verified. | `gates.deployment.dev` → `passed` | `--note` |
| `dev_failed` | Dev deployment failed. | `gates.deployment.dev` → `failed` | `--note` |
| `dev_skipped` | Dev deployment explicitly skipped. | `gates.deployment.dev` → `skipped` | `--note` |
| `prod_deploy_expected` | Prod deployment evidence is pending. | `gates.deployment.prod` → `expected` | `--note` |
| `prod_checked` | Prod deployment verified. | `gates.deployment.prod` → `passed` | `--note` |
| `prod_failed` | Prod deployment failed. | `gates.deployment.prod` → `failed` | `--note` |
| `prod_skipped` | Prod deployment explicitly skipped. | `gates.deployment.prod` → `skipped` | `--note` |
| `blocked` | Any agent hit an external blocker; halts the slice. | `gates.blocked` → `blocked` | `--note`, `--blocked-by <artifact-id>` |
| `specialist_recommended` | Builder (FEAT-180) determined the work belongs to a different specialist. | `gates.specialist` → `recommended` | `--note` |
| `escalated_to_dispatcher` | Builder hit a qualitatively-harder-than-dispatched task; needs dispatcher re-routing. | `gates.escalation` → `escalated` | `--note` |
| `escalated_to_lead` | Backward-compat alias of `escalated_to_dispatcher` (pre-FEAT-180 rename); resolves to the same gate. | `gates.escalation` → `escalated` | `--note` |
| `incident_resolved` | Full pass through `/crew:incident` triage completed (FEAT-182 SLICE-A). | `gates.incident` → `resolved` | `--note` |
| `rollback_executed` | Release-engineer-driven rollback executed (FEAT-182 SLICE-A). | `gates.incident` → `rolled-back` | `--note` |
| `incident_blocked` | Retry-exhaustion or a rollback decision needing user sign-off during `/crew:incident` (FEAT-182 SLICE-B). | `gates.incident` → `blocked` | `--note`, `--blocked-by <artifact-id>` |
