---
name: writing-task-handoffs
prompt_id: writing-task-handoffs
version: 1.0.0
tier: universal
description: Use when delegating or concluding substantial work so tasks, ownership, risks, and next steps are explicit and easy to inspect.
owner: sergeymilashico
last_reviewed: 2026-05-22
triggers: ["handoff", "delegate", "ownership change", "write-handoff"]
---

# Writing Task Handoffs

## Trigger

Use whenever work passes between lead, builder, reviewer, researcher, or the user — completion, mid-flight pause, blocker, or context-budget end. Always required for substantial work before returning to the lead.

## Overview

Use this skill whenever work passes between lead, builder, reviewer, researcher, or the user.

Without a clean handoff, the next agent (or the user) starts blind — they waste time rediscovering context that was already known. The handoff should be good enough that a new teammate can continue without guessing.

## Handoff Template

Include:

- objective
- owner
- allowed scope
- forbidden scope
- deliverable
- evidence or changed files
- confidence level
- risks or open questions
- suggested next handoff

## Quality Bar

A good handoff is:

- bounded
- specific
- inspectable
- honest about uncertainty

## Bad Handoffs

These waste the user's time by forcing the next agent to re-discover what should have been recorded:

- vague claims like "done" or "fixed"
- missing file or module boundaries
- no confidence statement
- no next step

## Artifact Location

When persisting a handoff, prefer:

- `.claude/artifacts/crew/handoffs/`

Preferred command:

- `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-handoff --repo "$PWD" --title "<short title>" ...`

## Done

The handoff is complete when:

- the artifact has been persisted via `write-handoff` (path returned)
- objective, owner, scope, deliverable, evidence, confidence, risks, and next step are all populated (no `-` placeholders for fields the situation actually has)
- the agent's inline reply is just the artifact path + a 1-3 sentence headline
