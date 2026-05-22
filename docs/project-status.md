# Crew Status

## Read This With

For full continuity after compaction, read this alongside:

- `docs/system-design.md`
- `docs/reference-repo-plan.md`
- `docs/memory-and-communication.md`
- `docs/memory-system.md`
- `docs/product-roadmap.md`
- `docs/implementation-commitments.md`
- `docs/validation-loop.md`
- `docs/how-it-feels.md`
- `docs/v1-spec.md`
- `docs/release-versioning.md`

## What We Are Building

`crew` is a Claude Code plugin for structured, legible lead-guided engineering work.

The goal is not a high-autonomy swarm. The goal is a lead-centered engineering workflow that makes substantial work easier to follow, safer to steer, and easier to inspect.

The current source-of-truth product framing now lives in `docs/system-design.md`.

Core ideas:

- one lead session stays user-facing
- specialist roles do bounded work when useful
- ownership stays explicit
- handoffs are structured
- observability is built in

## MVP Direction

The MVP should shine through a very small user-facing surface:

- `/crew:init`
- `/crew:adopt`
- `/crew:build`
- `/crew:fix`
- `/crew:review`

Claims, approvals, and artifact writers matter, but they are support machinery. They should increasingly be things the lead uses automatically or sparingly, not a growing list of commands the user must learn.

## Current Product Shape

The repo currently contains:

- a valid Claude Code plugin
- a local development marketplace manifest
- durable lead, builder, reviewer, and researcher agents
- reusable skills for operating mode, handoffs, and review gates
- workflow commands for short user-facing entry points plus compatibility aliases
- coordination commands for claims and approvals
- internal artifact-writing support for run briefs, handoffs, reviews, and final syntheses
- hook wiring for basic lifecycle logging
- a real installer CLI for repo adoption and repo initialization
- automated tests and an end-to-end filesystem smoke test

## What Has Been Done

### Plugin Foundation

Implemented:

- `.claude-plugin/plugin.json`
- `.claude-plugin/marketplace.json`
- `agents/`
- `skills/`
- `commands/`
- `hooks/hooks.json`

Validated:

- `claude plugin validate <path-to-this-repo>`

### Installer

Implemented:

- `scripts/crew.mjs`
- `scripts/lib/installer.mjs`

Supported commands:

- `audit`
- `bootstrap`
- `init`
- `wake-up`
- `claim`
- `release`
- `show-claims`
- `show-conflicts`
- `request-approval`
- `show-approvals`
- `resolve-approval`
- `write-run-brief`
- `write-handoff`
- `write-review-result`
- `write-final-synthesis`

Behavior:

- creates or extends `CLAUDE.md`
- writes `.claude/crew/constitution.md`
- writes `.claude/crew/workflow.md`
- writes `.claude/hooks/log_event.sh`
- creates `.claude/artifacts/crew/`
- merges `.claude/settings.json` hook config conservatively

### Tests

Implemented:

- `tests/installer.test.mjs`
- `tests/cli.test.mjs`
- `scripts/e2e-smoke.mjs`

Verified:

- `npm test`
- `npm run e2e:smoke`

### CI And Versioning

Validated in live repo work:

- CI now runs tests on pull requests
- CI also checks plugin version consistency
- plugin versioning is currently manual-on-change, not auto-bumped on merge

Current release guidance:

- bump versions for user-visible plugin behavior changes
- keep `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` aligned
- prefer manual release cadence for now

### Local Plugin Installation

Completed in this thread:

- added a temporary local marketplace from a copied plugin path under `/tmp`
- moved the dev install to a stable path at `C:/work/mega/hero-crew`
- reinstalled `crew@crew-dev` at user scope from the stable marketplace

Important note:

- the current installed dev marketplace now points at the stable development copy
- the `/tmp` install path is no longer the active development setup

### Live Claude Code Validation

Validated in a real Claude Code session:

- `/crew:audit-repo` on an existing repo before bootstrap
- `/crew:bootstrap-repo` on an existing repo with pre-existing `CLAUDE.md` and `.claude/`
- `/crew:audit-repo` after bootstrap to confirm harness presence
- hook output written to `.claude/logs/events.jsonl`
- a bounded feature workflow in `makeadz`
- a clean single-session bug investigation and fix in `makeadz`
- repo-local claims round-trip in `makeadz` via `show-claims`, `claim-files`, `show-conflicts`, and `release-files`
- repo-local approval queue round-trip in `makeadz`
- an assisted single-session CI/versioning task that added PR test automation and a version-consistency gate
- a substantial `terminal-art-club` feature run that used wake-up, run brief, reviewer, review artifact, and final synthesis in one flow

Observed lessons:

- the plugin is already useful as a structured workflow layer even before claims/state are implemented
- small, tightly coupled tasks should usually remain single-session
- the mode model needed a third category: `assisted single-session` for background helpers that do not form a communicating team
- `assisted single-session` appears to be the most common and natural real-world mode so far
- assisted single-session should be treated as a strength: bounded subagents save lead context, reduce drift, and improve focus
- a substantial run with reviewer plus artifacts feels materially more distinct than a default Claude session
- wake-up briefs must verify `pwd` against the returned `repoPath`; otherwise the lead can trust the wrong repo context
- reviewer should be treated as the default for substantial implementation work, not an optional nice-to-have
- logs are firing in real sessions, but the event schema needs richer structure
- mixed-plugin environments can blur attribution, so isolated tests are valuable
- claim semantics must distinguish `owned by me` from a real conflict
- repo-scoped CLI commands need the correct `--repo` path or they will look at the wrong state files
- the normal user journey should stay centered on a few workflow commands, with the rest treated as internal or advanced tools
- manual versioning plus CI consistency checks is sufficient for now; auto-bump-on-merge is not yet necessary
- artifact CLI ergonomics matter in practice; common aliases like `--verdict` and working subcommand help reduce workflow friction
- memory should become a standalone feature track, but v1 must stay bounded: stable repo memory plus current live state plus the latest useful artifacts, not the full archive
- the most promising next workflow distinction is a validator loop: local scenario validation, PR/dev/prod promotion gates, and logs/metrics evidence
- the user should mostly talk to the lead; commands should be optional entry points, and the lead should infer build/fix/review/validate intent from normal conversation when it is clear

## Where We Are Now

The project is past concept stage and into usable v1 groundwork.

What is working today:

- plugin structure
- installer CLI
- repo initialization
- repo bootstrap for existing repos
- filesystem-level smoke testing
- local plugin installation through Claude Code
- live audit/bootstrap in Claude Code
- live workflow execution in Claude Code
- repo-local claims/state and live claim round-trips in Claude Code
- repo-local approval queue in the installer and CLI
- artifact writers in the installer and CLI
- workflow prompts now explicitly instruct the lead to use artifact writers for substantial runs
- workflow prompts now start from a repo wake-up brief built from durable state
- wake-up now follows an explicit bounded-v1 memory shape with hot, warm, and cold buckets
- CI for tests and version consistency

What is not yet proven:

- real team-run artifact generation during feature or bug workflows
- approval queues or richer task-board state

What now looks more important than originally expected:

- lead behavior
- bounded subagents
- review and validation gates
- memory and workflow nudges

## Current Gaps

1. The installer is intentionally minimal and does not yet generate richer repo-local agents or stronger automatic workflow behavior.
2. Hook logging exists, but the event schema is still intentionally thin.
3. Workflow commands describe the operating model but do not yet enforce all of it.
4. Claims and approvals work, but they are still too visible as standalone mechanics instead of mostly living under the main workflows.
5. Approval queue exists and works, but its UX still needs refinement.
6. Artifact writers now have a clear workflow path, but they still need to be exercised in live Claude Code.
7. Richer task-board state is still not implemented.
8. Release/version workflow is documented, but still manual.
9. The new wake-up brief needs live validation in Claude Code.

## Recommended Next Steps

### Next Immediate Step

Turn the current internals into a simpler product experience:

- keep the user story centered on the five core workflow commands
- use claims only when parallel work actually risks collision
- use approvals only for meaningful boundary crossings
- live-test artifact writers in Claude Code
- improve approval-kind UX so destructive requests are easy to route correctly
- decide whether artifact writing should be automatic for substantial runs

### After Coordination Refinement

Improve the generated repo harness:

- richer artifact templates
- stronger workflow prompts
- clearer repo-local state layout
- better bootstrap behavior around existing `CLAUDE.md`

### Next Structural Feature

Add the next layer on top of claims:

- clearer run board or sprint state
- lightweight task status tracking

### Next Memory Feature

Treat memory as its own small product area:

- keep startup memory bounded through wake-up summaries
- define hot, warm, and cold memory behavior
- improve artifact structure so later retrieval can become meaning-based
- explore reinforcement and decay only after bounded v1 memory feels solid

### Next Observability Feature

Expand the event schema so future tooling can consume richer run data, including:

- task and claim events
- approval events
- subagent events
- handoff and review artifact references
- ownership transitions

## Borrowed Ideas We Want To Explore Further

From prior repo research, the most promising directions are:

- light startup plus on-demand heavy orchestration
- file claims or repo-local task state
- cleaner event schema for future visualization
- optional approval gates for risky actions
- stronger plugin-maintenance patterns
- clearer run/spec templates
- selective future specialist-role improvements

Candidate repos worth deeper local inspection:

- `barkain/claude-code-workflow-orchestration`
- `MarioGiancini/conductor-protocol`
- `patoles/agent-flow`
- `gaurav-yadav/agent-conductor`
- `obra/superpowers-developing-for-claude-code`
- `aws-samples/sample-claude-code-agent-team`
- `VoltAgent/awesome-claude-code-subagents`

## Suggested Stable Development Setup

Move the local plugin development copy out of `/tmp` and into a stable path such as:

- `C:/work/mega/hero-crew`

Then:

1. point the local marketplace at that stable path
2. reinstall or update the plugin from there
3. continue live testing against the stable copy

## Useful Commands

Validation:

- `claude plugin validate <path-to-this-repo>`

Installer:

- `npm run installer:audit -- --repo <path>`
- `npm run installer:bootstrap -- --repo <path>`
- `npm run installer:init -- --repo <path>`

Smoke:

- `npm test`
- `npm run e2e:smoke`

Further planning:

- `docs/reference-repo-plan.md`
- `docs/memory-and-communication.md`
- `docs/event-schema.md`

Next implementation slice:

- live-test artifact creation through the main workflow commands
- live-test wake-up brief usage at the start of a real workflow
- expand event coverage beyond session-start hooks
- keep release/versioning simple unless real pain appears

## If We Compact

The important continuity points are:

- this is a Claude Code plugin, not a standalone orchestration app
- the installer CLI already exists and works in tests
- live Claude Code validation has succeeded for setup, workflows, and claims
- the next build slice is simplifying the visible UX while wiring approvals/artifacts into the core workflows
- the next likely feature area is repo-local state and stronger observability
