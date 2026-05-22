# Memory And Communication Model

## Purpose

This document defines how Crew agents should recover context, build new memory, and communicate with each other.

For the smaller product-oriented memory policy and roadmap, see [memory-system.md](./memory-system.md).

The goal is to avoid hidden or mushy agent memory and replace it with explicit, inspectable working memory.

## Core Principle

Agents should not rely on hidden long-lived memory to understand the project.

Instead, they should reconstruct context from:

- repo memory
- run memory
- role definitions
- a fresh wake-up brief

This makes the system:

- easier to inspect
- easier to recover after compaction
- less likely to drift
- safer when the repo changes between sessions

## Memory Layers

### 1. Repo Memory

Stable project knowledge that should persist across tasks and sessions.

Examples:

- `CLAUDE.md`
- `.claude/crew/constitution.md`
- `.claude/crew/workflow.md`
- repo conventions
- architecture notes
- important commands

This is the main durable knowledge layer.

### 2. Run Memory

Knowledge about the current or recent run.

Examples:

- run brief
- current ownership split
- claims state
- handoffs
- review results
- final synthesis

Suggested locations:

- `.claude/artifacts/crew/runs/`
- `.claude/artifacts/crew/handoffs/`
- `.claude/artifacts/crew/reviews/`
- `.claude/state/crew/`

### 3. Role Memory

Stable role behavior and expectations.

Examples:

- lead rules
- builder scope discipline
- reviewer gate rules
- researcher read-only behavior

This should live in:

- `agents/`
- command-loaded lead guidance
- shared protocol/workflow guidance

### 4. Recency Memory

What changed since the role last worked on this repo or task area.

This should not be assumed from hidden personal memory.

It should be rebuilt from:

- recent repo changes
- new artifacts
- claims/state updates
- recent handoffs and reviews

## Wake-Up Briefs

Every agent should begin important work with a wake-up brief.

The wake-up brief is the system’s way of reconstituting context without relying on undocumented memory.

### Why Wake-Up Briefs Matter

Even if an agent worked on this repo before, the repo may have changed:

- new commits
- new files
- changed ownership
- new handoffs
- new review findings
- different active goal

So the system should assume:

the agent is capable, but not currently up to date.

### Lead Wake-Up Brief

Yes, the lead should have one too.

The lead is the first agent to "wake up" in a session and must reconstruct the operating picture before assigning anyone else.

The lead wake-up brief should include:

- active user goal
- current repo path
- repo memory files
- current state files
- latest run artifacts
- recent changes that matter
- whether a team run is already in progress
- current claims or blockers
- current pace, if already established

The lead should use this to answer:

- what are we doing
- what changed since last time
- what is currently active
- what is safe to do next

### Specialist Wake-Up Brief

A builder, reviewer, or researcher wake-up brief should be smaller and more task-focused.

It should include:

- role
- objective
- owned scope
- forbidden scope
- relevant files
- relevant repo rules
- relevant recent changes in owned scope
- current claims
- required artifact on completion

This should feel like a mission brief, not a transcript dump.

## How Agents Build New Memory

Agents should build new memory by leaving artifacts and state updates.

They should not build important memory only inside conversation history.

Examples of memory-building outputs:

- run brief
- task handoff
- review result
- final synthesis
- claims update
- approval log

This gives future sessions and future agents something concrete to recover from.

## Approval Model

Approvals are for decisions that should pause work briefly instead of being improvised silently.

The approval queue should stay small and legible.

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

## Do Agents Remember Old Features?

Not through hidden personal memory.

They should reconstruct old feature context from:

- current code
- repo memory
- prior handoffs
- prior review artifacts
- recent run summaries
- git history when needed

So the answer is:

- hidden memory: no
- explicit recoverable memory: yes

## Do Agents Notice New Pushes Or Changes?

They should not assume they are current.

Instead, each wake-up brief should include a freshness layer:

- what changed since the last relevant artifact
- what changed in their owned scope
- whether previous assumptions may now be stale

This is especially important for:

- the lead at session start
- a builder resuming paused work
- a reviewer validating code after new edits landed

## Team Structure Awareness

Every team member should know the team structure.

That means each agent should know:

- who the lead is
- what roles exist on this team
- what each role is responsible for
- when to communicate with the lead
- when specialist-to-specialist communication is appropriate
- what message format is required

This awareness should be present in both:

- durable role definitions
- run-specific task briefs

## Communication Model

The communication model should be strong and explicit.

It should not depend on casual improvisation.

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

## Where This Should Be Implemented

The protocol should live in two places:

### 1. Agent Definitions

For stable role behavior:

- `agents/builder.md`
- `agents/reviewer.md`
- `agents/researcher.md`

### 2. Task Or Run Briefs

For current mission specifics:

- current goal
- current ownership
- current scope
- current team structure
- current freshness context

This is important: role definition alone is not enough, and task prompt alone is not enough.

The system needs both.

For the lead specifically, the lead identity should come from the active workflow command plus shared workflow guidance rather than a spawnable `agents/lead.md` file.

## Implementation Guidance

Crew should implement this model through:

1. repo memory files
2. installer-generated artifact directories
3. repo-local state files
4. wake-up brief generation
5. strong communication protocol in agent definitions
6. strong communication protocol in run/task prompts

## Near-Term Product Implications

The next concrete steps this implies are:

1. Add repo-local state and artifact templates.
2. Add wake-up brief generation for the lead and specialists.
3. Strengthen agent definitions with explicit team-structure awareness.
4. Make task/run commands produce stronger mission briefs.
5. Ensure logs and artifacts capture enough information to support wake-up briefs later.
