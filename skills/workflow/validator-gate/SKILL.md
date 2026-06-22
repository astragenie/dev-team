---
name: validator-gate
prompt_id: validator-gate
version: 1.0.0
tier: workflow
description: Verifier dispatch decision procedure — when to dispatch crew:verifier, what constitutes the mandatory full gate, and the only allowable skip path.
owner: sergeymilashico
last_reviewed: 2026-06-13
triggers: ["verifier dispatch", "validation gate", "validator gate", "skip validation", "crew:verifier"]
---

# Validator Gate

## Trigger

Load when the dispatcher needs to decide whether and how to dispatch `crew:verifier` after a code-bearing slice completes.

## Verifier Dispatch Decision (mandatory full gate)

**Always dispatch `crew:verifier` on any code-bearing slice.** Fullstack-devs run only affected-class tests + typecheck (scoped fast inner loop); verifier owns the only always-on full gate — whole-repo lint, `format:check`, complete test suite, `verify:all`. No skip path: a code-only diff still needs the verifier because that's where the full suite runs.

The only validation gate that may be recorded as skipped is one explicitly recorded via a `crew:document-writer` dispatch with `badge: validation_skipped` + `reason: <text>` (e.g. environment unavailable) — never an implicit skip on "tests already green".

## Done

Validator gate decision is complete when:

- `crew:verifier` has been dispatched on any code-bearing slice (no exceptions)
- any skip has been explicitly recorded via `crew:document-writer` with `badge: validation_skipped` + `reason: <text>`
- implicit skips on "tests already green" have been avoided
