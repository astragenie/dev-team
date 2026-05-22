# How Crew Is Meant To Feel

This document is not a spec.

It is a user-story description of the product we are trying to build, so we can feel the experience end to end.

## Morning: Starting A New Project

You open your laptop in the morning and decide that today you want to start a new project.

You already have Claude Code installed. You already have the `crew` plugin installed at user scope, so it is part of your normal environment.

You make a new directory for the project and open it in Claude Code.

Inside Claude Code, you do not need to remember a giant setup checklist. You run one command:

`/init-repo`

Claude Code, through Crew, lays down a small harness for the project:

- a `CLAUDE.md` file
- a small `.claude/crew/` layer
- repo-local settings and hooks
- artifact folders
- state folders

Nothing about this feels magical or hidden. If you inspect the repo, you can see what was created. If you dislike something, you can read it and change it.

The repo now feels "ready."

Not cluttered. Not overbuilt. Ready.

## What The User Literally Sees

Crew is meant to stay terminal-first.

The default visual model is Claude Code in a small number of intentional terminal surfaces, not a custom UI taking over the whole experience.

### Default Layout

For normal work, the user sees one main Claude Code window:

- **Lead window**
  This is the primary conversation.
  This is where planning, synthesis, pacing, and user-facing summaries appear.

For team work, the layout expands in a way that should still feel calm and legible:

- **Window 1: Lead**
- **Window 2: Builder**
- **Window 3: Reviewer**
- **Window 4: Researcher**

In practice these could be windows, tabs, or panes.
The important thing is the mental model:

- one visible lead
- a small number of specialist workspaces
- each workspace has one clear purpose
- and not every helper needs to become a full team workspace

### What Lives In Each Window

Lead window:

- active goal
- chosen mode: single-session, assisted single-session, or team run
- pace: slow, medium, or fast
- who owns what
- blockers
- milestone summaries
- final synthesis

Builder window:

- bounded implementation objective
- allowed scope
- forbidden scope
- changed files
- completion handoff

Reviewer window:

- review target
- evidence checked
- result: approved, approved_with_notes, or rejected

Researcher window:

- investigation question
- relevant paths or docs
- findings
- risks and suggested next handoff

### Where Status Appears

Status should live in four places:

#### 1. In the lead window

This is the main human-facing status surface.

It should tell the user, in plain language:

- what the team is doing
- which roles are active
- what changed recently
- what happens next

#### 2. In repo-local state files

For durable truth, the repo should contain:

- `.claude/state/crew/claims.json`
- `.claude/state/crew/history.jsonl`
- `.claude/artifacts/crew/runs/`

#### 3. In event logs

For debugging and replay:

- `.claude/logs/events.jsonl`
- `.claude/logs/payloads/`

#### 4. Optionally later, in a visual layer

A statusline, TUI, or browser view may come later.
The prototype should still work without it.

## The First Task

You tell Claude Code:

“I want to build the first version of this app. Start with auth, a simple dashboard, and a minimal API.”

Crew does not immediately explode into a swarm.

First, the lead stays with you.

The lead reflects the job back in a structured but lightweight way:

- what the current goal is
- whether this should be single-session, assisted single-session, or team-based
- what pace makes sense
- what is in scope
- what is out of scope

For a brand-new small repo, it might decide:

“This should start single-session. Parallelism would add overhead too early.”

For a slightly wider task, it might instead decide:

“This should stay assisted single-session. I’ll stay primary and use one bounded helper to check the risky path.”

That is part of the intended feel: the system is trying to help, not perform.

## The Repo Begins To Accumulate Memory

As work starts, the repo develops explicit memory in files.

Not fuzzy AI memory. Working memory.

That memory lives in places like:

- `CLAUDE.md`
- `.claude/crew/constitution.md`
- `.claude/crew/workflow.md`
- `.claude/artifacts/crew/`
- `.claude/state/crew/`

If you come back tomorrow, or compact the thread, the repo itself still explains the operating context.

That is one of the core feelings we want:

progress should persist in inspectable form.

## What Memory Each Agent Uses

Crew should be explicit about memory boundaries.

### Lead Memory

The lead should have access to:

- the current user conversation
- `CLAUDE.md`
- `.claude/crew/constitution.md`
- `.claude/crew/workflow.md`
- current run artifacts
- repo-local state and claims

The lead is the synthesizer, so it gets the broadest operational picture.

### Builder Memory

The builder should get:

- the exact objective
- allowed files or modules
- forbidden files or modules
- relevant implementation context
- repo conventions needed for the task
- the current handoff it is executing

The builder should not automatically inherit the entire repo story.

### Reviewer Memory

The reviewer should get:

- the original objective
- changed or claimed files
- the builder handoff
- verification context
- repo standards relevant to review

The reviewer is usually read-only and evaluation-focused.

### Researcher Memory

The researcher should get:

- the investigation question
- relevant code paths
- architecture context needed for the question
- previous findings if they matter

The researcher should not carry implementation ownership by default.

### Repo Memory vs Task Memory

Repo memory:

- `CLAUDE.md`
- constitution and workflow files
- stable repo conventions

Task memory:

- run brief
- handoff
- review result
- claims and state for current work

This split matters because repo memory should stay useful long-term, while task memory should be bounded and replaceable.

### What An Agent Sees On A Specific Task

When an agent starts a task, it should receive a bounded brief:

- role
- objective
- owned scope
- forbidden scope
- relevant files
- relevant repo rules
- required output artifact

That should feel like a mission brief, not a transcript dump.

## A More Complex Task Appears

Later, the task gets wider.

Maybe now you ask:

“Investigate this bug, trace the backend flow, patch it, and make sure we don’t regress the tests.”

Now the lead may decide this is worth splitting.

Not because “multi-agent” sounds impressive.
Because the work actually separates:

- researcher traces code paths
- builder makes the bounded fix
- reviewer validates the result

That is different from assisted single-session.

In assisted single-session, the lead stays primary and may use one bounded helper, but the helper is not treated as an independent teammate with its own coordination role.

If that split happens, Crew makes it legible.

It should be obvious:

- who owns what
- what files are being touched
- what is forbidden scope
- what artifact each person should leave behind

## Team Mode Should Feel Controlled

If the task becomes a team run, the user should still feel calm.

Not like a swarm is running away in the background.

The lead says what is happening in simple terms:

- “I’m assigning backend tracing to the researcher”
- “The builder owns these files”
- “The reviewer will validate after implementation”

Teammates acknowledge in a structured way.

They do not just disappear into work.

Each one says, in effect:

- what I own
- what I will not change
- what I need
- what I will deliver

That is a very important part of the intended product feeling.

The system should feel like a small, disciplined team.
Not a bag of hidden subprocesses.

## How Agents Communicate

The communication model should feel deliberate and low-noise.

### Main Communication Surfaces

#### User ↔ Lead

This is the main relationship.

The user mostly talks to the lead.
The lead turns requests into tasks, updates, and syntheses.

#### Lead ↔ Specialists

This is where assignments, redirects, and checkpoints happen.

These messages should be operational:

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

Allowed, but not the main default.

Useful examples:

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

That way intent does not disappear into scrollback.

## File Ownership Prevents Chaos

Suppose two things might touch the same file.

Crew should catch this before it becomes a merge mess.

The repo-local state layer keeps track of claims and ownership.

So if one worker owns `src/auth.ts`, another worker should not casually drift into that file.

If there is a conflict:

- it is surfaced early
- it is visible
- the lead can reassign or sequence the work

The user should feel:

“This system is preventing stupid collisions before they happen.”

## Observability Is Quiet But Present

While all this is happening, Crew is writing an event trail.

Not for surveillance.
For legibility.

Hooks record key lifecycle points.
Artifacts record handoffs and reviews.
Logs make the run reconstructable later.

This should feel like a black box becoming translucent.

You do not have to watch every moment, but if something weird happens, you can inspect:

- `.claude/logs/events.jsonl`
- `.claude/logs/payloads/`
- `.claude/artifacts/crew/runs/`
- `.claude/artifacts/crew/handoffs/`
- `.claude/artifacts/crew/reviews/`

The experience we want is:

you can trust the system more because it leaves tracks.

## The Review Gate

The builder finishes a change.

Crew should not let that silently turn into “done.”

Instead, the reviewer checks:

- did the task actually match the objective
- did the work stay in scope
- is there regression risk
- are tests or verification adequate

The review result becomes explicit:

- approved
- approved_with_notes
- rejected

This should feel more like a real engineering loop than a chat transcript.

Not slower for the sake of slowness.
Safer because the right boundary exists.

## When The User Wants To Move Fast

Some days the user will want more autonomy.

Crew should support that too.

The lead can shift pace:

- slow
- medium
- fast

Slow means more checkpoints and smaller chunks.
Fast means broader chunks and fewer routine updates.

Pace should also be visible in the rhythm of the windows:

- **slow**
  specialists start more deliberately, summaries happen more often, the next wave waits for clearer checkpoints
- **medium**
  milestone updates and moderate fanout
- **fast**
  specialists launch quickly, there are fewer pauses, and broader chunks happen before summary

The key product feeling here is not speed by itself.

It is that pace is intentional.

The user feels in control of the tradeoff between oversight and throughput.

## Adopting An Existing Repo

Now imagine a different day.

You already have a messy existing project with its own `CLAUDE.md`, maybe some `.claude/` files, maybe some existing habits.

You open that repo and run:

`/bootstrap-repo`

Crew should behave conservatively.

It should inspect before writing.
It should avoid trampling repo-owned guidance.
It should add a small framework layer and imports where possible.

This is an important product feeling:

the plugin should feel respectful of existing repos.

Not like an installer that assumes it owns the project.

## After A Few Weeks

After a few weeks of use, the repo should start to feel like it has an operating rhythm.

You open Claude Code and the environment already knows how to work here.

The lead knows the repo has a harness.
The files show how runs are structured.
The artifacts show what happened recently.
The state shows who owns what right now.

You are no longer starting from improvisation every day.

That is the real emotional target of Crew:

less babysitting
less re-explaining
less chaos
more legibility
more continuity
more trust

## What It Should Not Feel Like

It should not feel like:

- a roleplay simulation
- a giant prompt pretending to be a system
- a bureaucracy engine
- an agent swarm that needs even more babysitting
- a hidden framework that rewires the repo behind your back

If we are doing this right, it should feel like:

- a careful team lead
- a small disciplined engineering org
- a repo that remembers how work happens
- a terminal-first workflow with structure
- a system that becomes more understandable as it becomes more capable

## The Prototype Version

In the prototype phase, not all of this will be fully implemented.

But even the prototype should already give the user this basic feeling:

1. I can install it.
2. I can initialize or bootstrap a repo.
3. The repo becomes structured and inspectable.
4. Claude Code starts working in a more disciplined way.
5. When parallel work happens, it is clearer and safer.
6. I can inspect what happened afterward.

That is the bar for “working and useful.”
