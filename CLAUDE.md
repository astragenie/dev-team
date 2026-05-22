# Crew Plugin Repo

This repository builds a Claude Code plugin for structured multi-agent software work.

## Read First

If you are a future coding agent picking this repo up after compaction, read these in roughly this order:

1. `docs/project-status.md`
2. `docs/implementation-commitments.md`
3. `docs/reference-repo-plan.md`
4. `docs/memory-and-communication.md`
5. `docs/how-it-feels.md`
6. `docs/v1-spec.md`

These files capture:

- current implementation status
- borrowed ideas and planned next steps
- memory and communication model
- intended user experience
- core v1 architecture

## Development Priorities

Prefer changes that strengthen:

- clear role boundaries
- explicit handoffs
- inspectable artifacts
- conservative repo bootstrap behavior
- validation against real Claude Code plugin tooling

## Plugin Shape

The plugin is intentionally content-heavy and runtime-light.

- durable behavior belongs in `agents/`, `skills/`, and `commands/`
- hooks should stay small and auditable
- scripts should be thin helpers, not a hidden framework runtime

## Repo Rules

1. Validate plugin changes with `claude plugin validate <path-to-this-repo>`.
2. Prefer additive changes over rewrites.
3. Keep repo-specific guidance in this file and use the docs above as the continuity set.
4. Do not add heavy automation until the manual workflow is proven useful.
5. Favor explicit files and artifacts over implicit memory.

## Artifact Direction

When adding artifact-producing features, prefer:

- `.claude/logs/events.jsonl` for append-only event logs
- `.claude/artifacts/crew/` for task handoffs, reviews, and run summaries

## Current Focus

The next major implementation target is a conservative installer CLI that supports both existing and brand-new repos.

For existing repos, it should inspect and safely add or update:

- `CLAUDE.md`
- `.claude/agents/`
- `.claude/commands/`
- `.claude/settings.json`
- `.claude/hooks/`

For new repos, it should be able to initialize the repo and lay down the same harness with cleaner defaults.
