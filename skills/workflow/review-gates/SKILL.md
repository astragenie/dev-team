---
name: review-gates
tier: workflow
description: Use before declaring implementation work done to separate task-compliance review from code-quality review and make approval criteria explicit.
owner: sergeymilashico
last_reviewed: 2026-05-22
triggers: ["review", "PR", "mark-badge review_required", "approval"]
---

# Review Gates

## Trigger

Use before declaring any code-bearing or substantial non-code deliverable done. Also use when a lead is deciding whether to skip review and needs to record that decision explicitly.

## Overview

The user trusts the "done" signal to mean work has been independently checked. Skipping from "deliverable produced" to "done" without review means the user inherits unchecked risk.

Apply review gates before a code-bearing or substantial non-code deliverable is treated as complete.

Default rule:

- code-bearing deliverables require independent review — unreviewed code is a quality risk the user cannot easily undo
- substantial design, planning, or documentation deliverables should normally be reviewed before being called done
- if review is skipped, the lead should state that explicitly and explain why — silent skips erode the user's trust in the workflow
- repo standards and language-specific standards should be part of the review by default when they exist

## Gate 1: Task Compliance

Check:

- was the assigned objective actually completed
- did the work stay inside scope
- were required files or deliverables produced
- are open questions clearly called out

## Gate 2: Code Quality And Regression Risk

Check:

- correctness
- regression risk
- test coverage or verification quality
- obvious maintainability problems introduced by the change

## Gate 3: Repo And Language Standards

Check:

- repo-specific standards from `CLAUDE.md` or repo reviewer instructions
- global reviewer standards when they apply
- any configured review skills or language-specific standards named in repo or global reviewer instructions when they are available and relevant

The user relies on the review result to know what was actually checked. Leaving standards checking implicit means the user cannot tell whether their configured review program was applied. The reviewer should say which standards and skills were actually applied.

## Review Outcomes

Use exactly one:

- approved
- approved_with_notes
- rejected

## Required Review Output

Include:

- gates run
- repo standards checked
- configured review skills consulted
- evidence checked
- failures or risks found
- whether the task should advance
- required follow-up if rejected

When review materially completes, persist it with:

- `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-review-result --repo "$PWD" --title "<short title>" ...`

## Escalation Rule

If the reviewer finds scope drift or a missing spec boundary, send the task back to the lead rather than silently repairing the assignment.

## Done

Review is complete when:

- a decision (`approved` / `approved_with_notes` / `rejected`) has been chosen and recorded
- a `review-result` artifact has been persisted via `write-review-result`
- gates run, repo standards checked, configured review skills consulted, and evidence checked are all named in the artifact
- for code-bearing diffs, `--test-summary` (or `--test-summary-skip-reason` / `--non-code`) was populated per FEAT-023
