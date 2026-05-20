# Agent Protocol

This document defines how Crew agents communicate, request approvals, and stay aware of team structure. The memory model that previously shared this doc has moved to `./memory-system.md` — read that first for context on how agents reconstruct knowledge.

This document is a subsystem note for `./system-design.md`.

## Why This Doc Exists Separately

Memory (how agents know things) and communication (how agents work together) are related but distinct concerns. Bundling them in one doc led to readers having to triangulate across overlapping sections to answer either question cleanly.

This file owns:

- communication model between user, lead, and specialists
- required message shapes (start ack, progress, completion, review)
- approval model and routing
- team-structure awareness

`./memory-system.md` owns:

- memory layers (repo, run, role, recency)
- hot / warm / cold organization
- wake-up briefs and what they contain
- record discipline (when to write artifacts)

If a topic touches both, treat `system-design.md` as the tie-breaker.

## Team Structure Awareness

Every team member should know the team structure. That means each agent should know:

- who the lead is
- what roles exist on this team
- what each role is responsible for
- when to communicate with the lead
- when specialist-to-specialist communication is appropriate
- what message format is required

This awareness should be present in both:

- durable role definitions in `agents/`
- run-specific task briefs

Role definition alone is not enough. Task prompt alone is not enough. Crew needs both.

For the lead specifically, the lead identity should come from the active workflow command plus shared workflow guidance rather than a spawnable `agents/lead.md` file.

## Communication Model

The communication model should be strong and explicit. It should not depend on casual improvisation.

### Main Communication Surfaces

#### User ↔ Lead

This is the main relationship.

The user mostly talks to the lead. The lead turns requests into tasks, updates, and syntheses.

#### Lead ↔ Specialists

This is where assignments, redirects, and checkpoints happen. These messages should be operational:

- new assignment
- scope clarification
- interruption
- status request
- handoff instruction

#### Specialist → Lead

This should usually be structured:

- start acknowledgement
- blocker update
- completion report
- review result

#### Specialist ↔ Specialist

Allowed, but not the main default. Useful examples:

- researcher tells builder where the bug path is
- builder tells reviewer which files changed
- reviewer tells lead the task should be rejected and rescoped

This should be dependency-driven, not chatty.

### Communication Should Leave Traces

Important communication should usually become:

- a run brief
- a handoff file
- a review result
- a claims or approval update

That way intent does not disappear into scrollback. See `./memory-system.md` for the record discipline that backs this up.

## Required Message Shapes

These shapes apply to every specialist (builder, reviewer, validator, researcher, deployer). The lead may use them too when handing off to itself between phases of a single-session run.

### Required Start Acknowledgement

Every specialist should begin with:

- what I own
- what I will not change
- what I need from others, if anything
- what I will deliver

### Required Progress Update

When reporting progress, include:

- current status
- whether scope is still valid
- blocker, if any
- next expected handoff

### Required Completion Report

Every completion should include:

- what changed or what was found
- changed files or evidence checked
- confidence level
- risks or open questions
- suggested next handoff

### Required Review Result

Every review should include:

- approved, approved_with_notes, or rejected
- evidence checked
- risk or failure summary
- required follow-up, if rejected

## Approval Model

Approvals are for decisions that should pause work briefly instead of being improvised silently. The approval queue should stay small and legible.

### What Needs Approval

- scope expansion beyond the assigned brief
- overriding another role's file claim
- destructive or hard-to-reverse actions
- policy, architecture, or workflow changes that should not be decided unilaterally

### Who Approves What

- specialists ask the `lead` for normal scope changes and claim overrides
- the `lead` asks the `user` for destructive, wide-scope, policy, or architecture decisions
- the `user` can also proactively approve or reject anything that feels important

The point is not bureaucracy. The point is to make meaningful decisions inspectable and recoverable.

## Where This Should Be Implemented

The protocol should live in two places:

### 1. Agent Definitions

For stable role behavior:

- `agents/builder.md`
- `agents/reviewer.md`
- `agents/researcher.md`
- `agents/validator.md` (planned)
- `agents/deployer.md` (planned)

### 2. Task Or Run Briefs

For current mission specifics:

- current goal
- current ownership
- current scope
- current team structure
- current freshness context

## Implementation Guidance

Crew should implement this model through:

1. Strong agent definitions with explicit team-structure awareness
2. Strong communication protocol in agent definitions
3. Strong communication protocol in run/task prompts
4. The repo-local approval queue (already implemented; see `scripts/lib/approvals.mjs`)
5. The artifact and state layers documented in `./memory-system.md`

## Near-Term Product Implications

The concrete next steps this implies are:

1. Strengthen agent definitions with explicit team-structure awareness.
2. Make task/run commands produce stronger mission briefs.
3. Ensure logs and artifacts capture enough information to support wake-up briefs later (covered in `./memory-system.md`).
4. Refine approval-kind UX so destructive requests are easy to route correctly (tracked in `./project-status.md` known issues).
