# Change Quality Standards

Combined code-quality + minimal-change policy. The two were inseparable in practice — readable + cohesive code is what minimal-change preserves; bloat is what minimal-change prevents.

## Purpose

Prevent unnecessary rewrites, architecture churn, instability, and unmaintainable code.

AI-assisted engineering must prioritize:

- stability
- maintainability
- incremental evolution
- readability

## Core principles

### Code quality

- Prefer readability.
- Prefer small methods.
- Avoid premature abstraction.
- Avoid unnecessary rewrites.
- Prefer explicit over clever.
- Keep services cohesive.

### Minimal change

- Prefer the smallest safe change that solves the problem.
- Reuse existing architecture.
- Modify smallest possible scope.
- Avoid massive refactors.
- Preserve compatibility.
- Incremental migration preferred.

## Required workflow

Before modifying code:

1. Inspect existing implementation.
2. Inspect architecture patterns.
3. Inspect reusable components.
4. Inspect existing abstractions.
5. Evaluate minimal change path.

## Preferred changes

- Additive changes.
- Extension points.
- Reusable components.
- Incremental migration.
- Compatibility preservation.

## Forbidden behaviors

- Rewriting entire modules.
- Changing architecture without an ADR.
- Introducing frameworks without approval.
- Unnecessary abstractions.
- Premature optimization.

## Refactoring rules

Refactor only if:

- Duplication is harmful.
- Readability improves.
- Maintainability improves.
- Architecture becomes simpler.

## UI rules

Prefer:

- Extending the design system.
- Reusing existing components.
- Preserving layout consistency.

Avoid:

- Redesigning unrelated screens.
- Changing visual language unexpectedly.

## Database rules

Avoid:

- Destructive migrations.
- Schema churn.
- Unnecessary table redesigns.

Prefer:

- Additive migrations.
- Backward compatibility.
- Gradual evolution.

## When to stop refactoring

Stop when:

- The slice's acceptance criteria are met.
- The next change would touch files outside the slice scope.
- The next change would invalidate existing tests that aren't yours.
- You've already refactored 3 things in this slice — anything more belongs in a follow-up.

Continuing past these markers turns a focused slice into a sprawling diff that's hard to review and easy to regress.

## When to open a follow-up

Open a follow-up (and surface in Risks as `follow-up: <description>`) when you observed code that needs work but it's NOT in the current slice:

- Larger refactor that needs its own slice.
- Stack-wide pattern that needs a separate cleanup pass.
- Architectural concern (deserves an ADR).
- Tech-debt smell with no clear in-scope fix.

Never silently leave a `// TODO` without a tracked follow-up — see `skills/workflow/root-cause-discipline/` for the band-aid surface contract.
