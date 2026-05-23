---
name: tdd
tier: workflow
description: Drive feature work via Red-Green-Refactor. Use when implementing a new feature or fixing a bug — write a failing test first, write the minimum code to pass, refactor without changing behavior. Pairs with `crew:builder` and reviewer-phase TDD-presence checks (FEAT-011).
owner: astra
last_reviewed: 2026-05-23
triggers: ["TDD", "test-driven development", "red-green-refactor", "write a test first", "failing test"]
---

# TDD — Red-Green-Refactor

Test-driven development discipline. The reviewer agent (FEAT-011) enforces test presence on runnable changes; this skill makes the *how* explicit so builders don't backfill tests after the fact.

## When to Use

- New feature implementation.
- Bug fix where the bug is reproducible via a test.
- Refactor that should not change behavior — write the characterization test first to lock the current behavior, then refactor.
- Any change the reviewer agent will gate on test presence.

## When **not** to Use

- Pure docs / typo / formatting change.
- Removing dead code with no observable contract change.
- Spike / exploration where the goal is to learn, not to ship — write the spike, throw it away, then TDD the final version.

## The cycle

### 1. Red — write the failing test

- Test the **behavior**, not the implementation.
- The test must fail with a clear error message identifying *what* is missing — not a syntax error from referencing a function that does not exist yet (declare a stub first if needed).
- Run the test. Confirm it fails. Do **not** edit non-test code in the Red phase.

### 2. Green — write the simplest code that passes

- Smallest change. Hardcoded return values are fine if they pass the test. The next test will force generalisation.
- Do **not** edit tests in the Green phase. If the test is wrong, that is a Red-phase fix — go back, edit the test, re-confirm it fails for the right reason.
- Run the full test suite. All tests pass = commit.

### 3. Refactor — improve without changing behavior

- Extract names. De-duplicate. Tighten types. Rename for clarity.
- Tests stay green throughout. If a refactor breaks a test, revert and try a smaller step.
- Commit the refactor separately from the Green commit. Reviewers can verify Refactor commits did not change behavior by re-running tests against the pre-Refactor commit.

## Repeat

One new test at a time. Resist the urge to write five tests then five implementations — the discipline lives in the loop.

## Commit cadence

- One commit per Green phase.
- One commit per Refactor phase (or per logical refactor inside it).
- Commit messages: see [commit skill](../commit/SKILL.md). Use `✅ test:` for Red, `✨ feat:` / `🐛 fix:` for Green, `♻️ refactor:` for Refactor.

## Common failure modes

| Symptom | Fix |
|---|---|
| Wrote impl first, now backfilling tests | Stop. Revert impl. Restart Red. |
| Test passes on first run | Test does not actually exercise the new code — strengthen the assertion. |
| Green phase keeps growing | Each green step should be one small change. Split into multiple Red-Green cycles. |
| Refactor breaks tests | Step was too big. Revert. Take a smaller refactor. |
| Tests pass locally, fail in CI | Hidden dependency on test order or shared state. Make tests order-independent. |

## Anti-patterns the reviewer will flag

- Test added in the same commit as the impl, with no preceding Red commit on the branch.
- Tests that assert on private internals (line counts, function names) rather than behavior.
- Tests that depend on `setTimeout` / `sleep` instead of awaiting a deterministic condition.
- One mega-test covering five behaviors — should be five tests.
- Tests that pass without running the impl (no real exercise).

## This repo specifics

- Runner: `node --test` via `npm test`.
- Test files: `tests/*.test.mjs`.
- Manifest + skill validators are CI gates, not unit tests — TDD applies to behavior tests, not to validator scripts.
- E2E smoke (`scripts/e2e-smoke.mjs`) covers the install-flow contract; use it as a regression net, not a TDD entry point.

## Done / Stop-when

- Every new behavior in the change is covered by at least one Red→Green→Refactor cycle.
- Reviewer agent's TDD-presence check passes (FEAT-011 gate).
- `npm test` exits 0; no test is `.skip`ped without an inline reason.
- Commit history shows the cycle (Red commit before Green commit, Refactor commits distinct from Green commits).

## Attribution

Authored fresh for this repo. The Red-Green-Refactor pattern is the standard Kent Beck TDD discipline ([Test-Driven Development by Example](https://www.oreilly.com/library/view/test-driven-development/0321146530/), 2002); refactor guidance follows Martin Fowler's [Refactoring](https://martinfowler.com/books/refactoring.html) (2nd ed., 2018). No code or text copied from any prior skill source.
