# Validation Loop

This document is a subsystem note for [system-design.md](./system-design.md).

## Why This Matters

Engineering OS should not stop at "code changed and tests passed."

The stronger workflow is:

1. build or fix locally
2. validate locally with a concrete scenario
3. review the change
4. create or update the PR
5. deploy to dev when appropriate
6. validate and monitor dev
7. promote to production only when evidence is strong enough
8. monitor production and open a new issue if something looks wrong

This is where the product can feel meaningfully different from a normal Claude session.

## Reviewer vs Validator

The reviewer and validator are different roles.

### Reviewer

The reviewer checks the change itself.

Examples:

- correctness
- regressions
- scope drift
- missing tests
- unsafe patterns

The reviewer is mostly a code and diff gate.

### Validator

The validator checks whether the system behaves correctly in an environment.

Examples:

- run the local app or API
- execute a written validation scenario
- call endpoints
- inspect UI behavior
- check logs
- check metrics
- compare expected vs actual outcomes
- report evidence and gaps

Concrete examples:

- run an API validation script locally and compare response bodies, status codes, and side effects
- open the product in browser automation mode and complete a full user flow such as signup, checkout, or purchase
- capture screenshots during the flow and inspect for visual regressions, weak contrast, broken layout, or incorrect states
- monitor logs and telemetry while the flow is exercised to catch runtime errors, slowdowns, or unexpected backend behavior

The validator is an evidence gate.

Deployment evidence should also preserve concrete deployment identity when available:

- target environment
- resource or service name
- service URL
- revision, image, or release identifier

Deployment guidance should record whether that identity is only repo-derived, still partial, or live-verified from the actual platform.
After a real deploy or environment check, that guidance should be updated automatically with the concrete identifiers learned during the run.

## Validation Scenario

Before validation, the dispatcher or validator should write a short scenario.

It should include:

- goal
- environment
- setup
- steps
- expected results
- edge cases
- commands or URLs used
- evidence to collect
- rollback or stop conditions

This does not need to be a long test plan.

It should be specific enough that another agent can run it and report honestly.

## Local Loop

The local loop should be:

1. builder implements
2. tests run
3. validator writes or follows a scenario
4. validator runs the app/API locally
5. validator reports pass/fail with evidence
6. the dispatcher asks builder to fix if needed
7. loop until local evidence is clean or the user stops it

Example evidence:

- test output
- API responses
- screenshots
- log excerpts
- reproduction notes

## Dev Loop

After PR or merge when a dev deployment exists:

1. deploy to dev or confirm deployment
2. run the same scenario against dev
3. pull service logs
4. pull metrics where available
5. check errors, latency, CPU, memory, restarts, outages, and relevant telemetry
6. report evidence and risk

If dev validation fails, the dispatcher should not hand-wave it.

It should open or continue a fix loop:

- new issue
- new branch
- PR update
- follow-up investigation

## Prod Loop

Production promotion should require a short decision point.

The dispatcher should ask:

- do we have local validation
- do we have dev validation
- do logs and metrics look healthy
- what risks remain
- do we have rollback confidence

After production deploy:

1. run a safe validation scenario
2. check logs and metrics
3. report health
4. open a follow-up issue if something looks wrong

## Lead Nudges

The dispatcher should keep track of what is unfinished and nudge the user.

The user should not need to remember the workflow command graph.

Where possible, the dispatcher should recommend the next responsible step and ask for the smallest useful decision.

The desired loop is:

1. decide the next direction together
2. let the dispatcher run a substantial chunk independently
3. return with evidence and a recommended next decision

As Engineering OS improves, those independent work chunks should become longer, safer, and more complete.

Examples:

- "The PR is created but not merged. Do you want to merge or wait?"
- "Local validation passed. Do you want to deploy to dev?"
- "Dev validation passed, but we have not checked logs yet."
- "We have dev evidence. Do you want to promote to prod?"
- "Production deployed. Do you want me to monitor logs and metrics for a few minutes?"

The point is not autonomy for its own sake.

The point is to make the next responsible step obvious.

## Suggested Future Role

Add a `validator` agent.

Default behavior:

- read-only unless explicitly allowed to edit validation scripts
- can run commands and inspect environments
- writes validation reports
- collects evidence
- does not decide promotion alone

The validator should return:

- scenario run
- environment
- commands or checks performed
- evidence
- pass/fail verdict
- risks
- suggested next action

## Suggested Future Commands

Keep this small.

Possible public commands after the rename:

- `/crew:build`
- `/crew:fix`
- `/crew:review`
- `/crew:validate`
- `/crew:ship`

`validate` should run the evidence gate.

`ship` should coordinate the PR, dev, and prod promotion loop.

But the stronger product behavior is not just "user runs `/crew:ship`."

The dispatcher should notice when the work is ready to move forward and nudge the user into the shipping phase:

- PR ready but not merged
- local validation complete, dev deployment still missing
- dev deployment complete, dev evidence still incomplete
- dev evidence complete, production decision still missing
- production deployed, monitoring still recommended

## Open Questions

- How do we configure environment-specific commands per repo?
- How do we safely access logs and metrics providers?
- How much monitoring time should be default?
- Should validation scenarios be committed or stored as run artifacts?
- When should failed validation create a GitHub issue automatically?
