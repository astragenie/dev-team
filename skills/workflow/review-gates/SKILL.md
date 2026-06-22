---
name: review-gates
prompt_id: review-gates
version: 1.0.0
tier: workflow
description: Use before declaring implementation work done to separate task-compliance review from code-quality review and make approval criteria explicit.
owner: sergeymilashico
last_reviewed: 2026-05-22
triggers: ["review", "PR", "mark-badge review_required", "approval"]
---

# Review Gates

## Trigger

Use before declaring any code-bearing or substantial non-code deliverable done. Also use when the dispatcher is deciding whether to skip review and needs to record that decision explicitly.

## Overview

The user trusts the "done" signal to mean work has been independently checked. Skipping from "deliverable produced" to "done" without review means the user inherits unchecked risk.

Apply review gates before a code-bearing or substantial non-code deliverable is treated as complete.

Default rule:

- code-bearing deliverables require independent review — unreviewed code is a quality risk the user cannot easily undo
- substantial design, planning, or documentation deliverables should normally be reviewed before being called done
- if review is skipped, the dispatcher should state that explicitly and explain why — silent skips erode the user's trust in the workflow
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

### Silent-failure hunt (runnable changes)

A silent failure is code that swallows or hides an error path the operator needed to see. On any runnable change (server, worker, hook, CLI entry, scheduled job), scan for:

- **Swallowed errors**: empty `catch {}`, `catch (_) {}`, or `catch` blocks that don't log, re-throw, or convert to a typed result. Every catch must do one of: log + re-throw, log + return typed failure, or document the explicit reason for swallowing.
- **Catch-then-continue without telemetry**: a `try` around a side-effecting call where the `catch` continues control flow with no log line, no metric increment, and no `traceId` written. Operators cannot diagnose what they cannot see.
- **Promise rejection drops**: unawaited `async` calls in non-fire-and-forget paths (handlers, hooks, init code). `await` or attach a `.catch(logHookError)` — never assume the runtime will surface a rejected promise.
- **Inadequate fallbacks**: stale cache served without TTL on the fallback, default return values that hide an upstream 5xx, retry-then-success without recording the underlying failure. A fallback that masks the cause is worse than the original error.
- **Missing health-check tiers**: a runnable surface that exposes one `/healthz` covering everything. Split: **liveness** (am I alive?), **readiness** (can I serve traffic?), **startup** (have my one-time init steps finished?). Operators need all three to distinguish "deploy stuck" from "downstream broken" from "process dead."
- **Error-handling boundary mismatches**: a library function that calls `process.exit()` (repo rule 6), or a request handler that throws unhandled out of an `await` chain. Errors should be returned as typed results at function boundaries, surfaced as structured logs at process boundaries.

Flag any of the above as **needs_fix** with the exact file:line. Cite this section in the review artifact under `## Gate 2: Code Quality And Regression Risk` so the builder can target the fix without re-discovering the checklist.

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

If the reviewer finds scope drift or a missing spec boundary, send the task back to the dispatcher rather than silently repairing the assignment.

## Done

Review is complete when:

- a decision (`approved` / `approved_with_notes` / `rejected`) has been chosen and recorded
- a `review-result` artifact has been persisted via `write-review-result`
- gates run, repo standards checked, configured review skills consulted, and evidence checked are all named in the artifact
- for code-bearing diffs, `--test-summary` (or `--test-summary-skip-reason` / `--non-code`) was populated per FEAT-023
