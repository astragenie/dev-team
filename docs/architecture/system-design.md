# System Design

## Purpose

This document is the primary design document for the product named `crew`.

It defines:

- what we are building
- how it should feel to use
- what the main components are
- how those components interact
- what to build first

Supporting docs like [product-roadmap.md](./product-roadmap.md), [validation-loop.md](./validation-loop.md), and [memory-system.md](./memory-system.md) should be treated as subsystem notes derived from this design.

## Product Thesis

We are not building a general autonomous swarm.

We are building a lead-guided engineering workflow for Claude Code.

The user should mostly talk to one lead.

The lead should:

- understand intent from normal conversation
- suggest the next responsible step
- take a substantial chunk of work and do it independently
- use bounded subagents and quality gates when useful
- synthesize task-relevant context from repo memory, saved artifacts, git, and external tools
- manage durable working memory and artifact hygiene for the run
- record lessons learned and important decisions
- keep repo `CLAUDE.md` aligned with repo-specific durable guidance
- escalate to the user for risky, ambiguous, or approval-gated decisions
- return with evidence, risks, and the next recommended decision

The product promise is not "many agents."

The product promise is:

clear progress through real engineering work, with less workflow burden on the user.

## Desired User Experience

The system should feel:

- calm
- competent
- legible
- low-bureaucracy
- evidence-driven

The ideal interaction pattern is:

1. user and lead decide what should happen next
2. lead takes a meaningful chunk of work
3. lead uses helpers internally if useful
4. lead comes back with results, evidence, risks, and the next recommended decision

The user should not need to:

- remember which workflow command to run next
- manually choose reviewer vs validator vs deployer
- manage subagents directly
- reconstruct project state from long chat history

The lead should manage the manager.

## Product Name And Command Model

The product name is `crew`.

Why `crew`:

- short
- easy to type
- teamwork-oriented
- less abstract than `engineering-os`

Public commands should be a small set of entry points and shortcuts, not the whole control plane.

Likely future public surface:

- `/crew:brief-me`
- `/crew:build`
- `/crew:fix`
- `/crew:review`
- `/crew:validate`
- `/crew:ship`
- `/crew:init`
- `/crew:adopt`
- `/crew:install`

What they mean:

- `/crew:brief-me`
  Give the user a fixed-structure situational briefing: current objective, recent git/artifact activity, in-progress gates, blockers, reminders, and the next recommended step.
- `/crew:build`
  Build or extend a feature. The lead frames the task, implements directly or delegates bounded work, then runs review and validation where appropriate.
- `/crew:fix`
  Investigate and fix a bug or broken behavior. The lead should investigate, implement the smallest correct fix, then review and validate the result.
- `/crew:review`
  Run the review phase on completed work. Review is deterministic for code changes, and substantial non-code deliverables should also normally enter review before being treated as done. Review may include multiple configurable gates such as correctness, regressions, scope drift, test gaps, internal coding standards, language-specific checks, or security review. The lead should explicitly state which repo-configured standards and review skills the reviewer is expected to apply.
- `/crew:validate`
  Run a behavior/evidence gate. The lead should write or follow a validation scenario, run checks in the target environment, and return pass/fail evidence.
- `/crew:ship`
  Move work through PR, dev, and production with evidence. This includes merge readiness, deploy/validate loops, and promotion nudges.
  `ship` is both a user-facing entry point and a workflow phase the lead should recommend when the work is ready to move forward.
- `/crew:init`
  Set up a brand-new repo with the repo-local Crew harness.
- `/crew:adopt`
  Bootstrap an existing repo conservatively into the Crew workflow.
- `/crew:install`
  Install or update the one managed global Crew memory copy under `~/.claude/crew/`.

But the lead should also infer these workflows from ordinary conversation when the intent is clear.
In particular, the lead should notice when work is ready to move into PR, dev, or production, and nudge the user toward `ship` without waiting for the perfect command.

Commands are accelerators, not prerequisites.

Repo-local storage paths and scripts now use the `crew` namespace
(`.claude/state/crew/`, `.claude/artifacts/crew/`, `.claude/crew/`); the
installer migrates legacy `engineering-os` paths on the next `/crew:adopt`.
The managed global framework memory now lives under `~/.claude/crew/`, matching
the repo-local namespace. The installer migrates legacy `~/.claude/engineering-os/`
files and updates `CLAUDE.md` imports automatically.

Some workflows are distinct enough that the lead should treat them as workflow variants, not just ordinary `build` or `ship` runs.

Important examples:

- greenfield development
  This is not just feature work in an empty repo. It may involve ideation, narrowing scope, research, stack choice, architecture, data modeling, scaffolding, and the first vertical slice.
- initial deployment
  This is not the same as routine shipping. It may involve discovering or establishing the first deployment path, separating build from rollout, confirming resource naming, and creating the first post-deploy validation/monitoring loop.

These should reuse the same lead-centered system and base agents where possible, but they should eventually get distinct workflow shapes.

## Core Execution Model

The execution model has three modes:

### 1. Single-Session

The lead does the work directly.

Use this for:

- very small tasks
- tightly coupled tasks
- low-risk edits where delegation adds more overhead than value

Single-session does not mean "no review."

If code was changed, the work should still go through independent review by the reviewer agent unless there is an explicit, justified skip.

### 2. Assisted Single-Session

The lead remains primary and uses bounded subagents for focused tasks.

This is the default high-value mode.

Why it matters:

- saves lead context
- keeps subagents focused on smaller tasks
- reduces drift
- allows background and parallel work
- makes review and validation easier

This is not a compromise. It is a feature.

### 3. Team Run

Multiple agents with explicit ownership and handoffs.

Use this only when:

- there are clearly separable workstreams
- parallelism is real, not theatrical
- ownership boundaries can stay clear

This is an escalation mode, not the main promise.

## Workflow Variants

Some workflows need a different phase model, even if they still use the same lead, reviewer, validator, and deployer roles.

### Greenfield Development

Greenfield work is a distinct workflow family.

It may include:

- brainstorming and ideation
- narrowing scope to a first credible slice
- research and option comparison
- stack and architecture choice
- database or data-model design
- scaffolding and repo setup
- first vertical slice implementation

This should not be modeled as ordinary feature delivery in an empty repo.

### Initial Deployment

Initial deployment is a distinct shipping workflow.

It may include:

- discovering CI/CD and deployment paths
- separating build, publish, rollout, and verification
- deciding or confirming resource names and service URLs
- establishing the first environment evidence loop
- confirming the first post-deploy validation and monitoring flow

This should not be modeled as the same thing as routine dev/prod promotion.

## Main System Components

The system should be designed as a set of cooperating components.

### 1. Lead Workflow Layer

This is the center of the product.

Responsibilities:

- infer workflow intent
- frame the task
- chunk work into independent, bounded sub-tasks when that improves focus or parallelism
- choose execution mode
- decide when to delegate
- apply quality-gate policy and repo-specific gate rules
- reconstruct the working context from saved memory and external sources
- maintain run memory, artifacts, and important lessons learned
- keep repo-specific guidance current when needed
- escalate to the user deliberately when required
- synthesize outcomes
- nudge the user toward the next responsible step

### 2. Subagent Layer

This is how the lead chunks work.

The system should ship with a predefined subagent base, not invent helper roles ad hoc during a run.

Each base agent should have:

- a defined role and purpose
- a strong operational identity
- a maintained prompt
- a default model choice
- clear tool permissions
- clear handoff expectations

Current and future base roles:

- builder
- researcher
- reviewer
- validator
- deployer

These agents are lead tools, not user-facing responsibilities.

The lead should prefer sub-tasks that are:

- independently understandable
- bounded in scope
- easy to review
- safe to run in parallel when appropriate

Good chunking is one of the system's core capabilities.

Each base agent needs a strong operational identity:

- what role it is
- what it is responsible for
- what it must never do
- what counts as completion
- what kind of handoff it returns

This is not personality dressing.

It is how the system keeps roles trustworthy and differentiated.

The lead should start from these base agents and specialize them by task assignment, not by inventing new role definitions each time.

### 3. Quality Gates

These are where the workflow becomes more valuable than default chat.

Current:

- reviewer

Planned:

- validator
- later deployer-assisted promotion checks

The distinction matters:

- reviewer checks the change
- validator checks the behavior
- deployer manages environment transition

The lead should not improvise quality gates from scratch on every run.

The system should define a gate policy, and the lead should apply it.

### Enforcement Strategy

Gate enforcement should get stronger gradually, based on dogfooding evidence.

The intended ladder is:

1. prompt and workflow instruction
2. workflow-state visibility and next-step nudges
3. hook-based reminders at the moment of drift
4. narrow hard blocks for transitions that repeatedly fail in practice

The default preference is:

- start soft
- observe real behavior
- only add harder enforcement when softer mechanisms do not reliably work

This matters because Crew should feel helpful and legible before it feels restrictive.

Hard blocks should stay narrow and evidence-based.
They should be used for repeatedly missed transitions, not as the first answer to every workflow problem.

### Default Gate Policy

The current intended defaults are:

- if code changed -> review required
- if a substantial non-code deliverable was produced -> review normally expected before done
- if user-visible, system-visible, or externally observable behavior can be exercised meaningfully -> validation expected
- if work moves into dev or prod -> deployment checks and post-deploy validation expected
- if production is affected -> explicit user approval required before promotion

Repos should be able to add stricter gates, for example:

- security review for auth, payments, or external-facing APIs
- language-specific review gates
- standards checks for teams with stronger conventions

So the lead's role is:

- determine which gates apply from policy and repo rules
- run them in the right order
- explain what is still missing

not:

- invent the whole gate system ad hoc

Review itself should support multiple gates, not just one opinionated pass.

Examples:

- correctness and regressions
- test gaps
- scope discipline
- internal engineering standards
- language-specific conventions through repo-selected skills
- security-focused review when relevant

### 4. Memory Layer

Memory is one subsystem, not the whole product.

Its job is:

- recover the right context at startup
- keep memory bounded
- preserve useful project history
- organize saved knowledge so the lead can find what it needs when it needs it
- write back durable records after meaningful workflow steps

Current main surface:

- wake-up brief

Memory should support the lead, not overwhelm it.

It is not just storage.

It is storage plus retrieval plus write discipline.

The system should eventually enforce both sides:

- retrieval discipline before substantial work starts
- write discipline after meaningful workflow steps complete

The lead should not treat memory as optional note-taking.

It is part of the workflow contract.

### 5. Artifact Layer

Artifacts are durable, inspectable records of meaningful workflow steps.

Current artifacts:

- run brief
- handoff
- review result
- final synthesis

Planned artifacts:

- validation plan
- validation result
- deployment check

Deployment checks should preserve concrete deployment identity when available, for example:

- environment
- resource or service name
- service URL
- revision, image, or release identifier

The artifact and state layer should eventually support gate badges on work chunks, for example:

- review_required
- review_passed
- review_failed
- validation_passed
- validation_failed
- dev_checked
- prod_checked

The important rule is:

implementation alone is not completion.

Substantial work should require the appropriate badges before the lead treats it as done.

The same principle should apply to memory:

- substantial work should leave the right artifact trail behind
- a new substantial run should begin from retrieved context, not a cold guess

More strictly:

if any agent changed code, including the lead, the work should enter review.
If a substantial non-code deliverable was produced, the work should normally enter review before being treated as done.

### 6. Repo And Global Configuration Layer

This layer defines where behavior and configuration come from, and who owns each layer.

Current structure:

- plugin-owned framework logic
  This is the built-in Crew behavior: role prompts, workflow rules, default gate policy, artifact formats, and command behavior. It changes when the plugin changes.
- one managed global framework memory copy under `~/.claude/crew/`
  This is the stable user-machine layer. Its main job is to give Claude one global import surface for shared framework memory instead of copying framework docs into every repo.
- repo-owned `CLAUDE.md`
  This is the repo's durable local guidance: architecture notes, conventions, test commands, domain rules, repo-specific review expectations, and anything else that should stay true for this codebase.
- repo-local state/hooks/artifacts
  This is the repo's operational working trail: live state, hooks, approvals, claims, event history, and artifact records from real runs.

Planned:

- repo-specific environment configuration for validation and deployment
  This should describe how the repo runs in real environments, for example local run commands, test commands, dev and prod URLs, deploy commands, and service-specific notes.
  The environment surface should keep distinct evidence channels instead of flattening them:
  - logs
  - metrics
  - alerts / incidents
  - telemetry / product or domain events

Before this is formalized, deployment understanding should progress in three steps:

1. today:
   deployer may inspect CI/CD, infra, and deployment files directly when needed
2. next:
   deployer or lead writes durable repo deployment guidance after discovery, for example in `.claude/crew/deployment.md`
   this guidance should distinguish `repo-derived`, `partial`, and `live-verified` understanding
3. later:
   Crew formalizes that understanding into stable repo environment configuration

If repo files hide important identifiers behind secrets or opaque CI/CD configuration, deployer should resolve the live infrastructure identifiers when feasible instead of pretending the repo-only summary is complete.
After a successful deploy or environment check, deployment guidance should be updated with the concrete identifiers learned during the run.

The important distinction is:

- plugin logic defines how Crew works
- global framework memory gives Claude one stable shared framework layer
- repo instructions teach Crew how to work in this repo
- repo-local state and artifacts record what has happened in this repo
- environment configuration teaches validator and deployer how to exercise and observe real behavior

### 7. Observability Layer

This is how we inspect what happened.

Current:

- hooks
- event logging
- repo-local state
- artifacts

Planned:

- richer event schema
- validation/deployment evidence visibility
- better nudges derived from incomplete workflow state

For deployment and post-deploy validation, evidence should usually come from separate surfaces:

- service logs
- service metrics
- alerting state or incidents
- telemetry or product/domain events

Crew should not treat these as one interchangeable blob of "monitoring."

## Component Contracts

The system should be explicit about who owns what.

### User ↔ Lead

The user decides:

- goal
- priorities
- risky or destructive approvals
- deploy/promotion decisions

The lead decides:

- how to execute
- when to use helpers
- how to apply the review and validation process to the current task
- what the next recommended step is

The lead also owns context synthesis:

- read the right saved memory
- pull the right git or task-tracker context
- ignore irrelevant historical noise
- turn that into a usable operating picture for the current task

### Lead ↔ Subagents

The lead must give:

- objective
- scope
- forbidden scope
- deliverable
- whether the task is read-only or editable

Subagents must return:

- what they did or found
- evidence
- risks
- next suggested handoff

### Reviewer

Reviewer contract:

- read-only by default
- runs one or more review gates on completed work
- checks correctness, regressions, scope drift, and test gaps at minimum
- may apply repo-defined standards, language-specific skills, or security review steps
- does not rewrite for taste
- returns a gate result with clear required follow-up

Reviewer independence is non-negotiable:

- the reviewer must not be the same agent that implemented the change
- the reviewer must not review its own work
- the reviewer must not silently repair the code instead of reviewing it
- the reviewer exists to provide an independent gate, not a softer second builder pass

This applies across all execution modes:

- single-session
- assisted single-session
- team run

Review should be a phase, not a single hard-coded check.

The default expectation is:

- if code changed, review should happen unless explicitly and unusually skipped
- substantial code changes should always enter review
- substantial non-code deliverables should normally enter review before being treated as done
- repos can customize which review gates apply
- the lead applies the configured review policy and repo-specific review gates to the task
- the user should not need to assemble the review pipeline manually

### Builder

Builder contract:

- implements bounded changes
- stays inside assigned scope
- does not self-certify completion
- expects review and, when relevant, validation after implementation

Builder identity should be:

- implement clearly
- hand off honestly
- do not pretend implementation alone means done

### Validator

Validator contract:

- read-only by default unless explicitly allowed to edit validation scaffolding
- writes or follows a validation scenario
- runs checks in a named environment
- returns evidence plus pass/fail verdict
- does not decide promotion alone

Validator identity should be:

- verify behavior
- collect evidence
- state uncertainty honestly
- do not confuse validation with authorship or promotion authority

### Deployer

Deployer contract:

- manages environment transitions
- confirms target and deployment outcome
- coordinates with validator for post-deploy checks
- never promotes to production on its own authority

Deployer identity should be:

- move code between environments safely
- confirm what was actually deployed
- surface deployment evidence
- stop before risky promotion without explicit approval

### Memory

Memory contract:

- durable on disk
- bounded in prompt context
- summarized through wake-up
- should support decisions, not dump history

The lead is the primary consumer and curator of this memory:

- decide what matters now
- write back meaningful artifacts
- record lessons learned that should survive the run

## Workflow Architecture

The main workflows should all be lead-owned.

### Build

Use when the user wants new capability.

Expected shape:

- frame task
  This means clarifying what the user wants, pulling additional repo or external context when needed, asking only the necessary questions, planning the implementation shape, and splitting work into bounded sub-tasks when that will improve focus or parallelism.
- implement
  Implementation may happen directly or through bounded sub-tasks. Code-bearing sub-tasks should be independently reviewable.
- review
  Review should happen after code work, and at the sub-task level where practical.
- validate if behavior can be checked
- synthesize

### Fix

Use when something is broken or risky.

Expected shape:

- investigate
- implement fix
- review
- validate the fix
- synthesize

### Review

Use when the user wants a gate on completed work.

Expected shape:

- inspect completed work
- run the relevant review gates
- identify correctness, regression, standards, or security risk
- return approval / approval_with_notes / rejected

For substantial implementation work, and for substantial non-code deliverables that go through the same workflow, the result should also update workflow state:

- implementation complete -> review required
- review passed -> eligible for validation or final synthesis
- review failed -> back to implementation/fix loop

Execution mode does not change this:

- single-session code change -> review required
- assisted single-session code change -> review required
- team-run code change -> review required
- substantial non-code deliverable in any mode -> review normally expected before done

For sub-tasked work, review should happen at the sub-task level where practical.

That means:

- a completed code-bearing sub-task should enter review before being treated as done
- a substantial non-code sub-task or deliverable should normally enter review before being treated as done
- the lead can then integrate reviewed sub-task outputs into the larger run
- the final run may still need a higher-level synthesis or additional review pass

Review may also include additional repo-defined gates such as:

- language-specific review
- standards review
- security review

### Validate

Use when behavior must be tested as a system, not just as code.

Expected shape:

- write or load scenario
- run checks
- collect evidence
- return verdict and gaps

Validation should be expected when the result has behavior that can be meaningfully exercised, especially for:

- APIs
- frontend screens and UI states
- end-to-end user flows
- interactive behavior
- UI flows
- integrations
- bug fixes with a reproducible path

Examples:

- run an API validation script and compare responses against expected outcomes
- open the product in browser automation mode and execute a real user journey from start to finish
- exercise flows like signup, checkout, purchase, or settings changes and confirm the expected result
- capture screenshots and inspect the UI for obvious visual problems such as broken layout, poor contrast, or inconsistent states
- validate that logs and telemetry remain healthy while the flow is exercised

### Ship

Use when work is moving through PR, dev, and production.

Expected shape:

- confirm PR state
- confirm merge/deploy intent
- deploy or verify deployment
- validate and monitor
- recommend next promotion decision

Shipping should be gated by evidence:

- review complete
- validation complete where relevant
- dev evidence complete before prod promotion
- explicit user approval before production promotion

## Validation And Shipping Model

This is the most promising next differentiator.

### Local Loop

1. implement
2. run tests
3. validate locally with a scenario
4. review
5. fix if needed
6. synthesize

### Dev Loop

1. PR created or updated
2. lead asks whether to merge/deploy to dev
3. deployer deploys or confirms deployment
4. validator runs scenario against dev
5. validator checks logs and metrics
6. lead recommends next step

### Prod Loop

1. lead checks whether evidence is strong enough
2. user decides whether to promote
3. deployer deploys or confirms production revision
4. validator runs safe checks
5. validator checks logs and metrics
6. lead recommends monitor / fix / follow-up issue

## Memory As A Subsystem

Memory is important, but it is only one component.

Its job is:

- recover the right context at startup
- keep prompt context bounded
- preserve useful project history
- organize saved knowledge so the lead can find the right thing when needed
- decide what should be written down after meaningful work

Memory is not just storage.

It is storage plus retrieval plus write discipline.

### Memory Sources

The memory system should draw from:

- stable repo memory
  - `CLAUDE.md`
  - repo-specific instructions
  - global framework memory
- live state
  - claims
  - approvals
  - sprint/focus state
- artifact records
  - run briefs
  - handoffs
  - review results
  - final syntheses
  - later validation and deployment artifacts
- recent event history
- external context when relevant
  - git history
  - issues
  - task trackers
  - deployment/logging systems

Artifacts are one of the main ways memory gets recorded, but they are not the whole memory system.

### Memory Organization

Memory should be organized in a way the lead can retrieve it intentionally.

Current model:

- stable repo memory
- current live state
- latest useful artifacts
- small recent history

The current retrieval shape should stay simple:

- hot memory
  - active right now
- warm memory
  - recent and likely relevant
- cold memory
  - searchable history that should not auto-load

This organization matters because the lead needs to answer:

- what are we doing now
- what changed recently
- what still matters
- what prior decision or artifact is relevant to this task

### Memory Retrieval

Retrieval should happen in layers.

At startup or workflow start:

- load bounded hot memory
- summarize the most relevant warm memory
- do not auto-load cold memory

During a run:

- retrieve more only when the task calls for it
- prefer the most relevant artifact, not the biggest pile of notes
- pull external context only when it changes the decision

The lead should be able to find:

- the latest relevant run summary
- the latest review for the same area
- unresolved handoffs
- related prior bug or feature context
- relevant repo rules

without reading the entire project history every time.

### Memory Write Discipline

We also need rules for when memory is written.

The lead should write or update memory when:

- a substantial run starts
- a handoff happens
- a review completes
- a validation completes
- an important decision is made
- a useful lesson is learned that should survive the session

Not every thought should become memory.

Write memory when it is likely to help a future run.

### Future Memory Model

Once the basic model is reliable, memory can improve through:

- better retrieval over recent and related artifacts
- meaning-based retrieval
- reinforcement
- decay

That should make it easier for the lead to find the right prior artifact or decision at the right moment.

Memory should help the lead recover context quickly and make better decisions.

It should not become a transcript swamp.

## Configuration Model

We should keep a clean separation:

- plugin-owned behavior
- global framework memory
- repo-owned rules
- repo-local state and artifacts

Likely future repo config:

- local run command
- test command
- validation URLs
- dev deploy command
- prod deploy command
- logs/metrics access notes

This is needed for validator and deployer to become truly useful.

## Build Order

The right order is by dependency and learning value, not by novelty.

The first implementation priority should be the product core itself, not one later subsystem.

### Phase 1. Core Lead Workflow

Build the main thing first:

- lead infers `build`, `fix`, `review`, `validate`, and later `ship` from normal conversation when clear
- lead frames the task well
- lead retrieves the right bounded context before planning substantial work
- lead chunks work into bounded sub-tasks
- lead uses predefined base agents as internal tools
- code-bearing work enters independent review by default
- substantial non-code deliverables also normally enter review before done
- meaningful workflow steps write the right artifacts by default
- lead returns with evidence, risks, and the next recommended decision

This is the meat of the product.

Without this, validator or deployer will just feel like extra parts bolted onto a weak core.

### Phase 2. Product Surface And Positioning

- rename/reframe toward `crew`
- simplify the public command surface
- keep commands as shortcuts, not the only interface
- make the lead interaction model legible in docs and prompts

### Phase 3. Validator

- add validator role
- add validation scenario skill
- add validation artifacts
- dogfood local validation

### Phase 4. Shipping Loop

- add deployer role
- add `ship` workflow
- add dev/prod evidence loop

### Phase 5. Environment Configuration

- make repo-specific validation/deploy configuration practical

### Phase 6. Richer Observability And Memory

- better event schema
- better nudges
- richer memory retrieval

## Non-Goals

We should explicitly avoid:

- forcing full agent teams as the default
- turning every internal mechanic into a user command
- hiding decisions in magical autonomy
- automating production promotion without clear user approval
- overbuilding environment automation before local validation proves value
- letting memory become unbounded context sludge

## Success Criteria

The system is working when:

- the user mostly talks to the lead
- the lead can infer the right workflow from normal conversation
- the lead can take substantial independent work chunks safely
- reviewer and validator add real evidence, not ceremony
- the next responsible step is usually obvious
- project state is recoverable without reading the whole chat history

That is the target system.
