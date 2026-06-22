# Memory System

This document is a subsystem note for [system-design.md](./system-design.md).

## Why This Exists

Memory should be its own Engineering OS feature.

The problem is simple:

- we want sessions to recover context well
- we do not want startup context to grow forever

So memory needs two properties at once:

- durable on disk
- bounded in prompt context

But that is not enough on its own.

Memory also has to be organized and retrievable.

The real goal is:

- save the right things
- retrieve the right thing at the right moment
- avoid forcing the dispatcher to read a pile of old notes every time

So the memory system needs explicit discipline in two directions:

- retrieval discipline
- write discipline

If those are optional, memory will slowly become either stale or useless.

## What We Need Now

The v1 memory system should stay very simple.

It still needs four jobs:

1. store useful records
2. organize them into hot, warm, and cold layers
3. retrieve the most relevant few
4. write back new memory after meaningful work

At session start or workflow start, Engineering OS should load only:

- stable repo memory
  - `CLAUDE.md`
  - `.claude/crew/*.md`
  - especially durable repo guides like `.claude/crew/deployment.md` when they matter
- current live state
  - active claims
  - open approvals
  - sprint/focus state if present
- the most recent useful artifacts
  - latest run brief
  - latest final synthesis
  - latest relevant review
  - latest unresolved or relevant handoff
- a small amount of recent history
  - a few recent events
  - a little recent claim/history context if needed

It should not auto-load:

- all old artifacts
- all logs
- all resolved approvals
- the full archive

The wake-up brief should be the main surface for this.

During a run, the dispatcher should be able to retrieve more memory selectively from:

- recent artifacts
- related artifacts
- current state
- git history
- external systems like issues or task trackers when relevant

V1 does not need fancy semantic retrieval yet.

But it does need a clear retrieval discipline.

And it needs that discipline to be part of the process, not left to taste.

## V1 Rule

Memory can grow on disk.

Loaded memory must stay small.

That is the whole rule.

But a usable v1 also needs two operational rules:

1. substantial work should start from retrieved context
2. meaningful workflow milestones should write memory back

## Hot, Warm, Cold

Even in v1, it helps to think in three layers.

### Hot

What is active now and should usually be loaded:

- open approvals
- active claims
- latest run brief
- latest final synthesis
- unresolved handoff

### Warm

Recent useful things that should be retrievable but not always loaded:

- recent reviews
- recent handoffs
- recent syntheses
- recent events

### Cold

History that should stay searchable but almost never auto-load:

- old logs
- older artifacts
- resolved approvals
- stale runs

This organization exists so the dispatcher can quickly answer:

- what is active
- what changed recently
- what still matters
- what prior decision or artifact is most relevant to this task

## What The Wake-Up Brief Should Do

The wake-up brief should answer:

- where am I
- what are we doing
- what is active
- what changed recently
- what still matters

It should summarize.

It should point to deeper memory when needed.

It should not dump raw history.

It should also make retrieval easier by showing the most relevant starting points, not just counts.

Examples:

- latest relevant run brief
- latest review touching the same area
- unresolved handoff
- open approval
- current focus or sprint note

The wake-up brief is both a summary and a retrieval guide.

It should be treated as required startup behavior for substantial workflows, not an optional extra.

At a minimum, substantial workflow entry points should require:

- verify the repo and current working context
- read bounded current state
- read the most recent relevant artifacts
- summarize the current operating picture before planning implementation

If deeper historical context is needed, retrieval should happen selectively during planning or execution.

The dispatcher should not skip straight from a new request to implementation when meaningful repo memory exists.

## What We Record

V1 memory should be recorded mainly through artifacts and state.

Examples:

- run brief
- handoff
- review result
- final synthesis
- later validation plan/result
- later deployment check
- stable repo guides such as deployment guidance
- claims
- approvals

Artifacts are one of the main ways memory is written down.

This is why artifact discipline matters so much.

Without consistent artifacts, retrieval has nothing reliable to work with later.

## When We Record It

We should write memory when it is likely to help a later run.

That usually means:

- when a substantial run starts
- when ownership changes
- when review completes
- when validation completes
- when an important decision is made
- when a lesson learned should survive the current session

Not every intermediate thought needs to become memory.

But some writes should be expected, not optional.

For example:

- substantial run start -> run brief expected
- ownership handoff -> handoff artifact expected
- review completion -> review result expected
- validation completion -> validation result expected
- meaningful run completion -> final synthesis expected

The dispatcher should follow this write discipline by default.

## What Comes Later

Once v1 is working well, memory can get smarter.

The next level would be:

- meaning-based retrieval, not just recency
- reinforcement
  - memory that gets reused becomes easier to find
- decay
  - old unused memory becomes less likely to surface by default

That means the system could eventually retrieve things like:

- prior decisions about reviewer defaults
- related work on wake-up behavior
- relevant old syntheses for the same subsystem

without loading the whole archive every time.

## Enforcement Direction

The system should eventually enforce memory behavior in the same way it enforces review or validation behavior.

That likely means:

- workflow entry points check retrieval before planning continues
- major workflow phases check whether expected artifacts already exist
- workflow completion notices when required artifact writes are missing
- wake-up and planning surfaces point to retrieval gaps, not just state summaries

In other words:

- no substantial work should start fully cold when useful memory exists
- no substantial work should finish without leaving the right trace behind

## Ideal Direction

Longer term, good memory should feel like this:

- recent important things surface automatically
- older important things are still easy to find
- irrelevant history stays quiet
- repeated useful knowledge becomes more prominent
- stale knowledge fades unless it becomes relevant again

## Practical Roadmap

### Step 1

Keep wake-up bounded and useful.

### Step 2

Make artifacts easier to summarize and rank.

### Step 3

Add better retrieval over recent and related artifacts.

### Step 4

Experiment with meaning-based search, reinforcement, and decay.

## Success

Memory is working when a new session feels informed, not overloaded.

More concretely, it is working when:

- the dispatcher starts substantial work from the right bounded context
- the dispatcher can retrieve deeper relevant context when needed
- artifact writing is consistent enough that later retrieval is reliable
- old history does not flood the prompt by default
