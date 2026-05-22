# Reference Repo Analysis And Crew Plan

## Purpose

This document captures what we learned from four local reference repos and translates that into concrete changes for `crew`.

Reference repos inspected locally:

- ``<reference-repos-dir>`/claude-code-workflow-orchestration`
- ``<reference-repos-dir>`/conductor-protocol`
- ``<reference-repos-dir>`/agent-flow`
- ``<reference-repos-dir>`/agent-conductor`

Additional reference repos to use as pattern libraries:

- `obra/superpowers-developing-for-claude-code`
- `aws-samples/sample-claude-code-agent-team`
- `VoltAgent/awesome-claude-code-subagents`

## Current Crew Position

Today, `crew` already has:

- a valid Claude Code plugin
- installable local marketplace
- lead, builder, reviewer, and researcher agents
- reusable skills
- commands for `audit-repo`, `bootstrap-repo`, `init-repo`
- a conservative installer CLI
- basic hooks and event logging
- automated tests and a filesystem smoke test

What it does not yet have:

- live proven command behavior inside Claude Code sessions
- structured repo-local coordination state
- strong file ownership or claim protection
- richer event schema
- persistent run artifacts from actual team workflows
- approval gates for risky operations

Update after live testing:

- live Claude Code validation has now succeeded for setup, workflows, claims, and approvals
- the next missing layer is real artifact usage during runs, not just artifact directories
- the next product risk is not capability, but UX sprawl; the user surface should stay centered on a few main workflows

## Repo Findings

### 1. barkain/claude-code-workflow-orchestration

Most useful ideas:

- light startup plus heavy orchestration only when needed
- strong SessionStart injection pattern
- richer hook governance
- explicit execution planning with dependency waves
- output style and statusline as optional UX layer

What to borrow:

- startup stub plus on-demand heavy workflow mode
- hook layering as a first-class product surface
- clearer mode selection between simple work and orchestrated work

What not to copy:

- enforced delegation for nearly everything
- overly rigid tool blocking
- large prompt bureaucracy as a default experience
- full task-wave engine for v1

Crew impact:

- keep normal sessions light
- only activate heavier orchestration when the task merits it
- add a clearer startup constitution injection path

### 2. MarioGiancini/conductor-protocol

Most useful ideas:

- file claims before editing
- conflict prevention instead of conflict cleanup
- lightweight JSON state
- status dashboard concept
- sprint priority config

What to borrow:

- repo-local claims state
- commands for claim, release, status, conflicts, cleanup
- simple state templates

What not to copy directly:

- user-global `~/.conductor/` state as the only source of truth
- product-specific north-star alignment behavior

Crew impact:

- add `.claude/state/crew/claims.json`
- add repo-local coordination commands
- keep state inspectable and easy to repair by hand

### 3. patoles/agent-flow

Most useful ideas:

- observability first
- hook setup that is idempotent and self-marking
- stable event transport
- live stream plus JSONL replay model

What to borrow:

- a documented event schema
- hook identity markers so installer updates are clean
- event logs shaped for future visualization

What not to copy now:

- the browser UI
- the relay server stack
- any heavy visualization work before the event contract is stable

Crew impact:

- improve log_event payload shape
- add event schema docs
- make hook merging/updating more robust

### 4. gaurav-yadav/agent-conductor

Most useful ideas:

- approval queue with audit trail
- clear separation between explicit relay and automated inbox behavior
- local control plane thinking
- durable role profiles and runtime logs

What to borrow:

- minimal approval workflow for risky actions
- explicit migration path from manual coordination to automated coordination
- audit logging for approvals

What not to copy now:

- tmux orchestration
- REST server and SQLite control plane
- provider abstraction layer

Crew impact:

- add a lightweight repo-local approval queue
- start with simple file-based approvals and audit logs
- avoid a standalone server unless a real need appears

### 5. obra/superpowers-developing-for-claude-code

Most useful ideas:

- plugin-authoring patterns for Claude Code itself
- self-documenting development workflow
- explicit skills/docs for maintaining the plugin

What to borrow:

- stronger "developing Crew" guidance inside the plugin repo
- skills or docs that help future-you extend the plugin consistently

What not to copy:

- any product-specific ceremony that does not strengthen Crew directly

Crew impact:

- add a maintenance/dev skill later
- keep the repo self-explanatory for future sessions and compaction

### 6. aws-samples/sample-claude-code-agent-team

Most useful ideas:

- clean team structure
- spec-driven execution
- separation between agents, rules, and skills

What to borrow:

- stronger run/spec templates for active work
- a cleaner boundary between durable rules and run-specific artifacts

What not to copy:

- any sample-specific team topology that is too generic for our needs

Crew impact:

- add clearer run brief, handoff, review, and synthesis templates
- consider a `.claude/specs/` style layout if artifact growth justifies it

### 7. VoltAgent/awesome-claude-code-subagents

Most useful ideas:

- broad role catalog
- prompt structure patterns
- tool-assignment discipline by role

What to borrow:

- selective role prompt improvements
- ideas for future optional specialists

What not to copy:

- treating a large role catalog as the product itself
- role explosion before the core workflow is proven

Crew impact:

- keep the core team small
- selectively improve lead, reviewer, researcher, and future specialist prompts

## Recommended Changes To Crew

### Priority 1: Live Integration Validation

Before expanding features, prove the current plugin works in real Claude Code sessions.

Tasks:

- run `/reload-plugins`
- run `/audit-repo`
- run `/init-repo`
- run `/bootstrap-repo`
- verify `.claude/logs/events.jsonl`
- verify hooks actually fire in session

Why this comes first:

- we already have enough product to test
- live friction should shape the next design decisions

### Priority 2: Repo-Local Coordination State

Add a repo-local state directory:

- `.claude/state/crew/claims.json`
- `.claude/state/crew/history.jsonl`
- `.claude/state/crew/sprint.json`
- `.claude/state/crew/approvals.jsonl`

Initial claims file shape:

```json
{
  "version": "1.0",
  "updatedAt": "2026-01-01T00:00:00Z",
  "runs": [],
  "claims": {},
  "warnings": []
}
```

Why repo-local:

- matches the repo-centric nature of Claude Code work
- easier to inspect and commit selectively if useful
- avoids hidden global state

### Priority 3: Coordination Commands

Add commands like:

- `/claim-files`
- `/release-files`
- `/show-claims`
- `/show-conflicts`
- `/approve-work`
- `/review-handoff`

These should begin as thin wrappers over repo-local files, not as a separate service.

### Priority 4: Event Schema And Logging Upgrade

Define a stable event schema in docs and update the logger to match it.

Add fields such as:

- `timestamp`
- `event`
- `repoPath`
- `sessionId`
- `runId`
- `taskId`
- `role`
- `summary`
- `artifactPath`
- `payloadPath`

Why:

- enables future visualization
- helps debugging without adding a dashboard yet
- makes logs useful across sessions and compaction

### Priority 5: Hook Identity And Merge Safety

Upgrade installer hook merging to use a marker strategy similar in spirit to Agent Flow.

Goals:

- recognize hooks owned by Crew
- replace outdated Crew hooks without duplicating them
- preserve unrelated user or repo hooks

This is a concrete improvement to:

- `scripts/lib/installer.mjs`

### Priority 6: Startup Mode Split

Adopt a lighter startup model inspired by Barkain.

Behavior:

- SessionStart loads a small constitution layer
- heavy orchestration stays opt-in via commands like `/build-feature`, `/parallel-review`, `/investigate-bug`

Why:

- keeps normal sessions usable
- avoids turning every interaction into ceremony

### Priority 7: Artifact Templates

Extend installer output with starter templates:

- `.claude/artifacts/crew/runs/run-brief.md`
- `.claude/artifacts/crew/handoffs/task-handoff.md`
- `.claude/artifacts/crew/reviews/review-result.md`
- `.claude/artifacts/crew/runs/final-synthesis.md`

Why:

- makes the workflow concrete
- reduces variance in handoffs and reviews
- gives compaction-safe continuity

### Priority 8: Minimal Approval Gate

Add a file-based approval queue for risky operations.

Initial scope:

- wide-scope edits
- destructive shell commands
- claim override requests

Do not build:

- a server
- background daemons
- tmux orchestration

Just add:

- a queue file
- audit log
- commands to approve or reject

## Concrete Crew Modifications

### Installer Changes

Modify:

- `scripts/lib/installer.mjs`

Add:

- repo-local state files
- artifact templates
- better hook markers
- smarter settings merge behavior

Likely new generated paths:

- `.claude/state/crew/claims.json`
- `.claude/state/crew/history.jsonl`
- `.claude/state/crew/approvals.jsonl`
- `.claude/artifacts/crew/runs/`
- `.claude/artifacts/crew/handoffs/`
- `.claude/artifacts/crew/reviews/`

### New Commands

Add:

- `commands/claim-files.md`
- `commands/release-files.md`
- `commands/show-claims.md`
- `commands/show-conflicts.md`
- `commands/approve-work.md`

Potential follow-up commands:

- `commands/start-run.md`
- `commands/write-handoff.md`
- `commands/review-run.md`

### New Docs

Add:

- `docs/event-schema.md`
- `docs/coordination-state.md`
- `docs/live-integration-checklist.md`
- `docs/memory-and-communication.md`

Potential follow-up docs:

- `docs/role-library-notes.md`
- `docs/plugin-maintenance.md`

### Logging Changes

Modify:

- `scripts/log_event.sh`

Potentially add:

- a small Node helper for structured event append logic

### Skills Or Workflow Refinement

Modify:

- `skills/using-crew/SKILL.md`
- `skills/writing-task-handoffs/SKILL.md`
- `skills/review-gates/SKILL.md`

To include:

- claims awareness
- artifact paths
- approval escalation points

## Implementation Order

1. Complete live Claude Code integration testing.
2. Add repo-local coordination state templates through the installer.
3. Add claims and conflicts commands.
4. Upgrade event logging and document schema.
5. Improve hook merge logic.
6. Add artifact templates.
7. Add minimal approval queue.

## Immediate Next Build Slice

If we are choosing the next concrete implementation work after this research pass, it should be:

1. Add repo-local state generation to the installer.
2. Add `claim-files`, `release-files`, and `show-claims`.
3. Add `docs/event-schema.md`.
4. Update `scripts/log_event.sh` and installer hook merge logic to align with that schema.

This is the smallest slice that directly incorporates the best ideas from the reference repos without overbuilding.

Shortly after that:

5. Add wake-up brief generation for the lead and specialist roles.
6. Strengthen agent definitions and task prompts with explicit team-structure awareness and communication protocol.

## Validation Notes From Real Claude Code Tests

What we learned from live testing:

- `crew` already works as a useful structure layer in Claude Code, not just in local tests
- audit and bootstrap flows behaved conservatively on a real existing repo
- hooks and event logging are firing in live sessions
- small tasks should usually stay single-session instead of forcing a team
- explicit, bounded planning is already adding value
- the next real need is repo-local coordination state, not a heavier orchestrator

## What Not To Build Yet

Avoid these until the simpler model proves insufficient:

- tmux orchestration
- local REST server
- SQLite control plane
- real-time dashboard UI
- full task-wave scheduler
- broad tool-blocking or forced delegation

## Decision Summary

The best path is:

- keep Crew as a Claude Code plugin
- keep the runtime small
- add repo-local state, claims, and stronger logs
- validate everything in real sessions
- delay heavy orchestration infrastructure until we hit a real wall
