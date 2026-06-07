---
description: Preferred short entry point for running the validation phase on runnable or observable behavior.
---

# Validate In The Lead Workflow

This is the preferred short entry point for the validation phase.

Use it when behavior can be exercised meaningfully after implementation and review.

For what counts as "substantial" below, see the canonical definition in `constitution.md` (`What "Substantial" Means`).

Expected shape:

1. verify the repo and read bounded wake-up context
2. identify the scenario, flow, or environment to validate
3. if the validation scenario is substantial, write a validation plan
4. run the validation checks and collect evidence
5. write the validation result and update workflow state immediately when validation materially completes
6. return pass/fail evidence, residual risk, and the next recommended step

Validation should focus on behavior, not code style:

- APIs can be exercised with scripts or commands
- UI flows can be exercised in browser automation mode
- logs, screenshots, outputs, and telemetry can be used as evidence

When validation is expected, record that gate in workflow state:

- `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge validation_expected`

If the scenario is substantial, write a validation plan:

- `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-validation-plan --repo "$PWD" --title "<short title>" ...`

When validation materially completes, write the validation result:

- `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-validation-result --repo "$PWD" --title "<short title>" ...`

If validation is intentionally skipped, record that explicitly in workflow state:

- `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge validation_skipped --note "<reason>"`
