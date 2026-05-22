# Multi-Agent Crew v1

## Goal

Build a local-first, inspectable orchestration layer for coding work where a lead session coordinates a small team of specialists with:

- bounded ownership
- explicit task handoffs
- mandatory reporting
- visible state
- configurable pace

This v1 is not a general autonomous swarm. It is a controlled operating layer for real code work on one repo at a time.

The execution model should support three clearly named modes:

- `single-session`: one agent does the work directly
- `assisted single-session`: the lead remains primary and may use bounded helpers
- `team run`: multiple coordinated agents with explicit ownership and handoffs

## Non-Goals

- shared free-form group chat as the primary interface
- concurrent editing of the same file by multiple builders
- long-lived semantic memory across many repos
- fully automatic planning with no human legibility
- broad multi-repo awareness by default

## Product Shape

Recommended implementation: a local CLI with a small dashboard layer.

Core pieces:

1. `orchestrator`
   Creates runs, spawns teammates, assigns bounded tasks, records state, enforces gates.
2. `protocol`
   Defines the required message schemas for task start, progress, blockers, completion, and review.
3. `roles`
   Stores durable role contracts for the lead workflow plus builder, reviewer, and researcher specialists.
4. `policy`
   Applies constitution rules, pace settings, scope limits, and completion gates.
5. `observability`
   Writes append-only run events and task snapshots for inspection and debugging.

## Claude Code Integration Model

This system should be built as an official Claude Code plugin plus a conservative repo bootstrap flow.

### Important implementation note

Claude Code has a documented plugin system. Public Claude Code plugin docs describe:

- plugin components for skills, agents, hooks, MCP servers, and LSP servers
- plugin installation scopes: `user`, `project`, `local`, and `managed`
- plugin manifests at `.claude-plugin/plugin.json`
- plugin lifecycle commands such as install, enable, disable, uninstall, and update
- `CLAUDE.md` memory with `@path` imports
- hook events including `TaskCreated`, `TaskCompleted`, and `TeammateIdle`

That means the right v1 shape is:

- a user-installable plugin for reusable framework assets
- optional project-scoped plugin installation for team-shared repos
- a bootstrap command that prepares repo-local Claude Code files conservatively

## Distribution Model

### User scope

Install the plugin at `user` scope for a personal default operating system across projects.

This is the right home for:

- durable role definitions
- reusable workflow commands
- personal hooks and default settings
- optional MCP and LSP utilities used across many repos

### Project scope

Install the plugin at `project` scope when a repo should share the framework across collaborators.

This is the right home for:

- shared role definitions
- shared slash commands
- shared hook wiring
- project-visible MCP and LSP integration

### Local scope

Install the plugin at `local` scope for private per-project experiments or machine-specific setup that should stay gitignored.

This is useful for:

- local-only credentials or paths
- experimental team settings
- temporary debugging hooks

### Plugin contents

The plugin itself should provide reusable assets through the documented plugin layout, such as:

- `.claude-plugin/plugin.json`
- `agents/`
- `skills/` and or `commands/`
- `hooks/hooks.json`
- optional `.mcp.json`
- optional `.lsp.json`

### Repo bootstrap outputs

The bootstrap should add or improve repo-owned files such as:

- `CLAUDE.md`
- `.claude/agents/`
- `.claude/commands/`
- `.claude/settings.json`
- `.claude/hooks/`
- optional `.mcp.json`

These remain repo-owned and should stay small, import-oriented, and easy to inspect.

## Bootstrap Flow

The framework should expose a bootstrap command that prepares a repo for the operating model.

### For a new project

This should be exposed as a distinct `init-repo` workflow rather than overloading `bootstrap-repo`.

1. Create a new repository if needed.
2. Enable or install the plugin at the intended scope if it is not already active.
3. Create `CLAUDE.md` with repo-owned guidance plus framework imports.
4. Create `.claude/agents/`, `.claude/commands/`, and `.claude/hooks/` where appropriate.
5. Register repo-local hooks in `.claude/settings.json`.
6. Optionally configure project MCP servers or helper prompts.
7. Optionally enable the agent-teams environment setting where supported.
8. Create initial artifact directories so runs are inspectable from day one.

### For an existing project

The bootstrap must be conservative:

- inspect before writing
- import existing instructions instead of overwriting them
- keep framework rules in isolated files
- add only the smallest needed settings changes
- preserve repo ownership of repo-specific guidance

## Installer Modes

The installer should support two entry points:

### `bootstrap-repo`

Adopt the framework into an existing repository conservatively.

### `init-repo`

Create a new repository already shaped for the framework, with cleaner defaults and less migration logic.

## Repo Layout Pattern

The recommended repo shape is:

- `CLAUDE.md` for repo-owned instructions and imports
- `.claude/agents/` for durable project role definitions
- `.claude/commands/` for reusable workflows like investigate, build, review, and parallelize
- `.claude/hooks/` for logging and gate scripts
- `.claude/settings.json` for hook registration and shared settings
- optional `.mcp.json` for shared MCP integrations

The reusable framework logic lives in the plugin; the repo keeps only the project-specific layer.

## Recommended Stack

- TypeScript + Node.js for orchestration and CLI
- SQLite for run/task/session state
- JSONL event log for raw observability
- Markdown/YAML for role definitions and repo handbooks

Rationale: easy local distribution, strong ecosystem, good fit for structured CLI tooling, and simple inspection.

## v1 Data Model

### TeamRun

- `id`
- `repoPath`
- `goal`
- `pace`
- `status`
- `createdAt`
- `completedAt`

### Role

- `name`
- `purpose`
- `allowedActions`
- `forbiddenActions`
- `defaultDeliverable`
- `reviewEdges`

### AgentSession

- `id`
- `roleName`
- `runId`
- `status`
- `ownedScopes`
- `transcriptPath`

### Task

- `id`
- `runId`
- `ownerSessionId`
- `title`
- `objective`
- `allowedFiles`
- `forbiddenFiles`
- `dependencies`
- `deliverable`
- `status`
- `confidence`
- `handoffTarget`

### Event

- `timestamp`
- `runId`
- `sessionId`
- `taskId`
- `type`
- `summary`
- `artifactPath`

## Constitution Rules

These should be enforced in code where possible and otherwise reflected in prompts.

1. Every task must have one owner.
2. Every task must define allowed and forbidden scope.
3. Every agent must send a structured acknowledgement before starting work.
4. Every agent must send a structured completion report before a task can close.
5. Reviewer approval is required for implementation tasks before `done`.
6. The lead is responsible for synthesis, reassignment, and user-facing summaries.
7. Direct intervention is allowed when a teammate drifts or blocks.
8. Pace controls the maximum autonomous work chunk before reporting.

## Initial Roles

### Lead

- Owns planning, delegation, synthesis, and user communication
- Does not do large implementation work unless the run is explicitly single-agent
- Can interrupt and re-scope other roles

### Builder

- Owns bounded code changes
- Must stay inside assigned file or module scope
- Must return changed files, confidence, risks, and next handoff

### Reviewer

- Owns validation, regression detection, and test execution
- Can reject a completion with actionable feedback
- Should not expand scope into unassigned feature work

### Researcher

- Owns code reading, doc lookup, architecture tracing, and dependency questions
- Read-only by default
- Produces findings, options, and risks

## Required Protocol Messages

### Start Ack

Every teammate must begin with:

- what I own
- what I will not change
- what I need from others, if anything
- what I will deliver

### Progress Update

Must include:

- current status
- whether scope is still valid
- blocker, if any
- whether handoff is needed

### Completion Report

Must include:

- what changed or what was found
- confidence level
- risks or open questions
- suggested next handoff

### Review Result

Must be one of:

- `approved`
- `approved_with_notes`
- `rejected`

And must include:

- evidence checked
- failure or risk summary
- required follow-up, if rejected

## Pace Modes

### Slow

- small tasks
- more mandatory updates
- lower autonomy threshold

### Medium

- milestone updates
- normal default mode

### Fast

- broader task chunks
- fewer routine updates
- only boundary-level reporting

## Observability

v1 should ship with these outputs:

1. `logs/events.jsonl`
   Raw append-only event stream.
2. `state/run.db`
   Structured run, session, and task state.
3. `artifacts/`
   Per-task summaries, review notes, and transcript references.

Minimum event types:

- `run_created`
- `session_spawned`
- `task_created`
- `task_started`
- `task_progress`
- `task_blocked`
- `task_completed`
- `task_reviewed`
- `task_reassigned`
- `run_completed`

## First POC Workflow

Use one repo and one bounded change where ownership can be split cleanly.

### Recommended POC sequence

1. Lead creates run and selects pace.
2. Lead creates 2-3 tasks with strict ownership.
3. Researcher maps architecture or answers dependency questions.
4. Builder implements a bounded change.
5. Reviewer validates the change and either approves or rejects it.
6. Lead synthesizes outcome and proposes next step.

### Good first task shapes

- service logic + tests + docs
- bug fix + regression validation + root-cause notes
- API change + contract review + test update

### Avoid in first POC

- same-file parallel editing
- large refactors
- fuzzy ownership
- long-running autonomous runs

## Hard Parts

These are buildable, but they are where most v1 pain will live:

1. Reliable interruption and redirection of an already-busy agent
2. Making scope rules actually observable instead of aspirational
3. Handling partial context between lead and teammates
4. Preventing silent task drift
5. Keeping the system helpful without turning it into bureaucracy

## Success Criteria

The v1 is successful if it can do all of the following on a real code task:

- split work across lead, builder, reviewer, and researcher
- keep file ownership legible
- require structured handoffs
- show run state at any time
- leave an inspectable record of what happened
- reduce user babysitting compared to a single unstructured session

## Suggested Build Order

1. Define role files and constitution rules
2. Implement task/run state model
3. Add protocol validation for start and completion messages
4. Add event logging and transcript references
5. Add review gate logic
6. Add pace modes
7. Add a minimal dashboard or TUI

## Immediate Next Build Step

Scaffold a TypeScript CLI with:

- `create-run`
- `add-task`
- `list-tasks`
- `complete-task`
- `review-task`
- `show-run`

That is enough to test the operating model before building richer UX.

For Claude Code integration, also add:

- `bootstrap-repo`
- `init-repo`
- `audit-repo`
- `install-user-assets`
- `doctor-framework`
