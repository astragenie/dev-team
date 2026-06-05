---
id: FEAT-038
title: "Workflow badge awareness in all subagents"
priority: P2
status: done
category: workflow
target_release: null
autonomous_safe: false
cross_repo: null
parent_spec: null
related: [FEAT-037]
phase: null
tags: [stack:llm, surface:docs, concern:governance]
---
# FEAT-038 — Workflow badge awareness in all subagents

## Why

Only `agents/lead.md` documents the `blocked` / `escalated_to_human` / `*_skipped` badge
system. When a subagent (builder, reviewer, validator, deployer, researcher) hits an external
blocker, it has no harness-level vocabulary to signal it — it can only write a handoff with
prose in `--risks`. That badge never surfaces in `brief-me` or `wake-up`, so the lead and user
don't see the signal until they open the handoff artifact manually.

## Approach

Add a compact `## Workflow badges` section to all five subagent prompts. Each section:
- Lists the three actionable badges: `blocked`, `escalated_to_human`, role-specific `*_skipped`
- Shows the `mark-badge` CLI call with `--note` flag
- Defines when to emit each badge (before or alongside writing the handoff)

No new CLI behavior — the harness already supports these badges. This is purely a prompt change.

## Acceptance criteria

- [ ] AC-1: `agents/builder.md` has `## Workflow badges` section with `blocked` + `escalated_to_human` + `validation_skipped` guidance
- [ ] AC-2: `agents/reviewer.md` has `## Workflow badges` section with `blocked` + `escalated_to_human` + `review_skipped` guidance
- [ ] AC-3: `agents/validator.md` has `## Workflow badges` section with `blocked` + `escalated_to_human` + `validation_skipped` guidance
- [ ] AC-4: `agents/deployer.md` has `## Workflow badges` section with `blocked` + `escalated_to_human` + `deployment_skipped` guidance
- [ ] AC-5: `agents/researcher.md` has `## Workflow badges` section with `blocked` + `escalated_to_human` guidance
- [ ] AC-6: Each section shows the `mark-badge` CLI call format consistent with how lead.md describes it
- [ ] AC-7: `node ./scripts/validate-agents.mjs` passes (≤300 lines per agent)
- [ ] AC-8: `npm run lint && npm run format:check` clean
