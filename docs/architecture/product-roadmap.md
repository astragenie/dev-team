# Product Roadmap

This document is a build-order and product-shaping companion to [system-design.md](./system-design.md).

Use `system-design.md` for the main system definition.

Use [implementation-commitments.md](./implementation-commitments.md) for deferred-but-committed work we explicitly plan to build later.

## Current Read

Engineering OS is useful, but the original positioning is too broad.

In live use, the system has not often used full agent teams. The common successful shape has been:

- lead works directly
- lead uses bounded subagents when useful
- reviewer checks substantial changes, including substantial non-code deliverables
- wake-up memory restores context
- artifacts leave a durable trail

So the product should stop leading with "multi-agent team coordination."

Better positioning:

Crew is a lead-guided engineering workflow for Claude Code: build, fix, validate, review, remember, and ship with evidence.

The desired working rhythm is:

1. user and lead decide what should happen next
2. lead takes a substantial work chunk and runs it independently
3. lead uses helpers, reviewer, validator, or deployer when useful
4. lead returns with evidence, risks, and the next recommended decision

As the plugin improves, the independent work chunk should get larger and safer.

The default working mode is not "single agent" versus "full team."

The real center is:

- lead plus bounded subagents
- quality gates
- evidence-based progression

## Rename Direction

`engineering-os` is too long for daily slash-command use.

Preferred product name:

- `crew`

Why:

- short to type
- fits the team/workflow concept
- not too gimmicky
- works well in slash commands

Possible future command surface:

- `/crew:build`
- `/crew:fix`
- `/crew:review`
- `/crew:validate`
- `/crew:ship`
- `/crew:init`
- `/crew:adopt`
- `/crew:install`

Old commands can remain as compatibility aliases during transition.

Later, we may need distinct workflow variants beyond the base command set, especially for:

- greenfield development
- initial deployment

## Public vs Internal Commands

The public surface should stay small.

Public commands:

- build
- fix
- review
- validate
- ship
- init
- adopt
- install

Internal or advanced mechanics:

- claims
- approvals
- wake-up
- artifact writers
- show-conflicts
- show-claims

These can exist, but they should not be the normal UX.

Commands are explicit entry points and shortcuts.

The lead should also infer workflow intent from ordinary user communication when the intent is clear.

Examples:

- "Build this feature" -> build
- "This is broken" -> fix
- "Can we sanity-check this?" -> review or validate
- "Should we ship this?" -> ship

And when the user does not ask directly, the lead should still notice lifecycle state and recommend `ship` when the work is ready to move into PR, dev, or production.

## Agents Are Lead Tools

New agents expand what the lead can do.

They should not increase the user's command burden.

The model is:

- user talks to the lead
- lead chooses when to use builder, researcher, reviewer, validator, or deployer
- user approves direction, risky actions, deploys, and promotion decisions

The user should not have to remember:

- when to invoke reviewer
- when to invoke validator
- when to invoke deployer
- when to inspect claims or approvals

The lead should surface those steps naturally:

- "I am going to validate the behavior now."
- "This is ready for review."
- "Dev validation passed. Do you want to promote?"
- "Production deployed. I recommend monitoring logs for a few minutes."

This means new agents are primarily lead capabilities, not new responsibilities for the user.

## Core Workflow Modes

Keep the three-mode model:

- `single-session`: lead only
- `assisted single-session`: lead plus bounded helper agents
- `team run`: multiple agents with explicit ownership and handoffs

Based on dogfooding, `assisted single-session` is likely the default sweet spot.

`assisted single-session` should be treated as a feature, not as a compromise.

Why it matters:

- it saves lead context
- it keeps subagents focused on smaller tasks
- it reduces drift
- it makes review and validation easier
- it allows background and parallel work when tasks are independent

True team runs should be an escalation mode for larger work, not the main promise.

## Validator Agent

Add a `validator` role.

Reviewer and validator are different:

- reviewer checks the change
- validator checks the behavior

The validator should:

- write or follow a validation scenario
- run the local app or API when appropriate
- call endpoints or inspect UI behavior
- collect screenshots, logs, responses, and command output
- report pass/fail with evidence
- state what remains unverified

For the detailed validation model, see [validation-loop.md](./validation-loop.md).

## Review Phase

Review should be a required phase for code changes and a normal phase for substantial non-code deliverables.

It should not be limited to one fixed correctness pass.

Repos should be able to define multiple review gates, for example:

- correctness and regressions
- test gaps
- internal standards
- language-specific expectations via repo-selected skills
- security review when relevant

The lead should choose and run the appropriate review gates without making the user assemble them manually.

We also need an explicit gate policy, not just a reviewer role.

At minimum:

- code change -> review required
- substantial non-code deliverable -> review normally expected before done
- behavior change with a runnable or observable path -> validation expected
- dev/prod promotion -> deployment evidence and post-deploy validation expected
- prod promotion -> explicit user approval required

Enforcement should climb in stages:

1. stronger prompts and workflow wording
2. stronger state-aware nudges
3. hook-based reminders
4. narrow hard blocks only where dogfooding shows softer enforcement is still not enough

We should prefer the lightest mechanism that works reliably.

## Deployer Agent

Add a `deployer` role later, after local validation works.

The deployer should not be a generic "ship everything" agent.

It should own environment transitions:

- confirm deploy target
- run or request deployment command
- collect deployment output
- verify revision/version
- coordinate with validator for post-deploy checks
- stop and ask before risky production actions

The deployer should not decide production promotion alone.

Promotion remains a lead/user decision based on evidence.

Mention deployer in plans early, but do not build it before local validation is proven.

Deployer should not rediscover deployment from scratch forever.

The intended progression is:

1. today:
   inspect CI/CD, infra, and deployment files directly when needed
2. next:
   write durable repo deployment guidance after discovery, for example in `.claude/crew/deployment.md`
   distinguish `repo-derived`, `partial`, and `live-verified` guidance
   if repo files are opaque, resolve live infrastructure identifiers when feasible
3. later:
   formalize that understanding into repo environment configuration

Successful deploy or environment-check runs should write back the concrete identifiers they discovered so the next deploy does not need to rediscover them.

## Greenfield Development

Greenfield development is different enough to deserve its own workflow shape later.

It may include:

- ideation
- narrowing scope
- product or technical research
- architecture
- data modeling
- first repo setup
- first vertical slice

This should probably be a workflow variant of `build`, not just ordinary feature work in an empty repo.

## Initial Deployment

Initial deployment is different enough to deserve its own shipping workflow variant.

It may include:

- discovering the deployment path from CI/CD and infra files
- separating build from rollout
- confirming resource naming and service URLs
- creating the first post-deploy validation loop
- establishing the first logs/metrics/alerts/telemetry checks

This should probably be a workflow variant of `ship`, not the same thing as routine promotion.

## Local Validation Loop

Build this before dev/prod shipping automation.

Target loop:

1. lead frames the task
2. lead either implements directly or dispatches bounded subagents
3. tests run
4. validator writes or follows a scenario
5. validator runs local checks
6. reviewer reviews the change
7. lead asks builder to fix if needed
8. final synthesis records evidence and gaps

This is the next likely "wow" moment:

not just "tests pass," but "here is the scenario, evidence, and remaining risk."

## Dev And Prod Loop

Add after local validation is solid.

Target dev loop:

1. PR is created or updated
2. lead asks whether to merge/deploy to dev
3. deployer deploys or confirms dev deployment
4. validator runs the same scenario against dev
5. validator pulls logs and metrics
6. lead reports health and next step

Target prod loop:

1. lead checks whether local and dev evidence are sufficient
2. lead asks the user whether to promote
3. deployer deploys or confirms production deployment
4. validator runs safe production checks
5. validator pulls logs and metrics
6. lead opens a follow-up issue or fix loop if something looks wrong

## Lead Nudges

The lead should keep unfinished workflow state visible.

The user should not have to remember which command to run next.

The lead should manage the manager: notice incomplete workflow state, recommend the next responsible step, and ask for the smallest decision needed to continue.

Examples:

- "The PR is created but not merged. Do you want to merge or wait?"
- "Local validation passed. Do you want to deploy to dev?"
- "Dev validation passed, but logs have not been checked yet."
- "We have dev evidence. Do you want to promote to prod?"
- "Production deployed. Do you want me to monitor logs and metrics for a few minutes?"

This should feel like responsible engineering follow-through, not nagging.

The pattern should be:

- "Here is the next decision I need from you."
- "If you approve, I will handle the next work chunk and report back."
- "Here is what I completed, what I validated, and what I recommend next."

That is the target feeling:

- decide together
- let Claude go do a serious chunk of work
- return with evidence and the next recommended decision

## Environment Configuration

Validation and deployment need repo-specific configuration.

Possible future file:

- `.claude/crew/environments.md`

or:

- `.claude/crew/environments.json`

It should define:

- local run command
- test command
- validation URLs
- dev deployment command
- prod deployment command
- log commands
- metrics commands
- alert or incident checks
- telemetry or domain-event checks
- provider notes, such as Cloud Run service, project, and region

Start with markdown if we want flexibility.

Move to JSON only when automation needs structure.

## Memory And Global Setup

Keep the managed global memory direction:

- one global framework memory copy in `~/.claude/crew/`
- no per-repo constitution/workflow copies
- repo `CLAUDE.md` stays repo-specific
- rerun `/crew:install` after plugin updates that change framework memory

Later improvement:

- detect stale global memory and nudge the user to update it

## Deferred But Committed

When we explicitly agree that something should be built later, but not now, record it in:

- [implementation-commitments.md](./implementation-commitments.md)

This prevents "yes, later" decisions from being lost across sessions.

Memory details:

- [memory-system.md](./memory-system.md)
- [memory-and-communication.md](./memory-and-communication.md)

## Build Order

1. Rename/reposition docs toward `crew`, while keeping old command compatibility.
2. Strengthen review into a configurable multi-gate phase.
3. Define and encode explicit gate policy defaults.
4. Add `validator` agent.
5. Add validation scenario skill.
6. Add validation artifact kinds:
   - validation-plan
   - validation-result
7. Update build/fix workflow prompts so substantial work includes review, and validation when behavior can be checked.
8. Dogfood local validation on a real app/API task.
9. Add `deployer` agent after local validation is proven.
10. Add dev/prod `ship` loop with logs and metrics.
11. Add environment configuration once at least one real repo needs it.

## What Not To Do Yet

- Do not force full agent team runs as the default.
- Do not overbuild claims and approvals into user-facing commands.
- Do not automate production promotion without explicit user approval.
- Do not require structured environment config before local validation proves value.
- Do not rename everything until the command compatibility story is clear.
