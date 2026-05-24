---
name: using-crew
tier: workflow
description: Use at the start of real software work to choose the right mode, define pace, enforce ownership boundaries, and keep handoffs inspectable.
owner: sergeymilashico
last_reviewed: 2026-05-22
triggers: ["crew:build", "crew:fix", "crew:review", "crew:ship", "new task"]
---

# Using Crew

## Trigger

Use at the start of any substantial software work — building a feature, fixing a bug, reviewing changes, shipping a release. Also use when the user explicitly invokes `/crew:build`, `/crew:fix`, `/crew:review`, `/crew:ship`, or `/crew:brief-me`.

## Overview

Use this skill when the user wants help building, debugging, reviewing, or coordinating real code work.

The goal is not maximum autonomy. The goal is legible teamwork the human can actually follow.

## Role Model

- The user expects one clear lead per run. Assuming lead identity in a session that did not explicitly start one creates confusion about who is driving.
- The session explicitly running a Crew workflow command is the lead for that run.
- Spawned agents are specialists, not alternate leads.

## Shared Guidance Order

Before substantial work, read shared guidance in this order, if present:

- `~/.claude/crew/workflow.md`
- `.claude/crew/workflow.md`
- `~/.claude/crew/protocol.md`
- `.claude/crew/protocol.md`

If repo guidance conflicts with global guidance, prefer the repo guidance for this repo.

## Execution Model

1. Choose one of:
   - `single-session`
   - `assisted single-session`
   - `team run`
2. `single-session` is the default unless delegation clearly helps.
3. Use `assisted single-session` when the lead remains primary and a bounded specialist reduces uncertainty or validates work.
4. Use `team run` only when ownership can stay clean across multiple specialists.
5. Keep one owner per task.
6. Match the pace to the user's desired level of oversight.

## Required Framing

Before substantial work:

1. Verify the current workspace path:
   - `pwd`
2. Read the repo wake-up brief:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" wake-up --repo "$PWD"`
3. Explicitly confirm the returned `repoPath` matches the current working directory.
4. If the paths do not match, stop and call out the repo-context problem before using the brief.
5. Then state:

- active objective
- chosen mode
- pace: slow, medium, or fast
- what is in scope
- what is out of scope

Use the shared protocol guidance for start acknowledgements, progress updates, completion reports, review results, and handoffs.

## Artifact Habit

The user depends on artifacts to resume work after compaction, across sessions, or when context is lost. Skipping an artifact means the next session starts with no record of what happened.

When the work is substantial, create or update inspectable artifacts under:

- `.claude/artifacts/crew/`

Use the Crew CLI for this instead of inventing ad hoc files:

- `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" write-run-brief --repo "$PWD" ...`
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" write-handoff --repo "$PWD" ...`
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" write-review-result --repo "$PWD" ...`
- `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" write-final-synthesis --repo "$PWD" ...`

Review protects the user from regressions reaching their repo. It is the default for substantial implementation work. If review is skipped, say so explicitly and explain why.

## Red Flags

These situations create merge conflicts, wasted effort, or confused ownership that costs the user time. Stop and re-scope if:

- two agents need the same file
- the task boundary becomes fuzzy
- the work needs a broader refactor than assigned
- a teammate cannot explain ownership clearly

## Done

The framing phase is complete and the lead can proceed when:

- `pwd` and `wake-up`'s `repoPath` match
- mode (`single-session` / `assisted single-session` / `team run`), pace, and scope have been stated
- a run-brief artifact has been written for substantial work
- the matching `/crew:*` command's workflow steps are loaded and ready to execute
