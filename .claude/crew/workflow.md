# Engineering OS Workflow

## Preferred Sequence

1. verify the repo and current workspace
2. retrieve bounded wake-up context before substantial work
3. choose mode: single-session, assisted single-session, or team run
4. define task ownership and scope
5. **architect phase** _(conditional — skip if no ADR / system design / schema / API contract is needed)_ — produces ADR or design artifact before implementation starts; lead decides at framing time
6. **uxdesigner phase** _(conditional — skip if no UI surface)_ — produces flow spec or component hierarchy before implementation starts
7. implement or investigate in bounded chunks
8. review code-bearing work before calling it done
9. validate behavior when it can be exercised meaningfully
10. **copywriter phase** _(conditional — skip if no customer-visible docs / release notes)_ — produces doc artifact after validation, before deploy
11. gather deployment evidence when shipping through environments
12. leave a final synthesis

## Default Gate Policy

Each gate protects the user from a different class of risk. Skipping a gate silently means the user assumes it passed when it did not.

- code changed -> independent review required (protects from regressions and quality erosion)
- runnable, observable, or user-visible behavior changed -> validation expected (protects from shipping broken behavior)
- deployment or promotion work -> deployment evidence expected (protects from unverified environment state)
- production promotion -> explicit user approval required (protects the user's production systems)
- substantial non-code deliverable changed (ADR, system design, UX flow spec, customer-visible docs, release notes) -> independent review expected; use `crew:reviewer` for content review the same way code-bearing changes go through review

## Write-Back Discipline

The user depends on these artifacts to resume work after compaction, across sessions, or when context is lost. Skipping a write-back means the next session starts with no record of what happened.

- substantial run start -> run brief
- ownership change -> handoff
- review completion -> review result immediately
- validation completion -> validation result immediately
- meaningful deployment evidence -> deployment check immediately
- substantial completion -> final synthesis

## Handoff Format

Every substantial handoff should include:

- objective
- owner
- allowed scope
- forbidden scope
- deliverable
- changed files or evidence
- confidence level
- risks or open questions
- suggested next handoff

## Ownership And Tests

Builder owns code-bearing tasks, including tests for changed behavior when practical. Reviewer
owns independent change review. Validator owns behavior validation when behavior can be exercised
meaningfully. Deployer owns environment evidence when shipping through dev or prod.

