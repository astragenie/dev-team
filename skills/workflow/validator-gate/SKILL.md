---
name: validator-gate
prompt_id: validator-gate
version: 1.1.0
tier: workflow
description: Verifier dispatch decision procedure — when crew:verifier is skipped in favor of the evidenced reviewer approval (satisfiedByReview), and the risk-gated exceptions where the dedicated full gate still runs.
owner: sergeymilashico
last_reviewed: 2026-07-08
triggers: ["verifier dispatch", "validation gate", "validator gate", "skip validation", "crew:verifier", "satisfiedByReview"]
---

# Validator Gate

## Trigger

Load when the dispatcher needs to decide whether and how to dispatch `crew:verifier` after a code-bearing slice completes.

## Verifier Dispatch Decision (FEAT-202 / SLICE-112 — lean review gate)

**Default (LOW/MEDIUM risk): delegate to the evidenced reviewer approval — do not dispatch `crew:verifier`.** `.claude/loop.json` sets `loop.validation.satisfiedByReview: true`; `deriveValidationGate` (runner-plugin `src/scripts/lib/validation-gate.mts`, shared via the loop plugin's `/runner:close` ceremony) resolves `satisfied: true` with a `review-badge:` reason from a real, evidenced `crew:reviewer` approval artifact — never from the tolerant absence/unproven fallthrough. The whole-repo full gate (lint, `format:check`, complete test suite, `verify:all`) is NOT dropped: it is owned by CI (`.github/workflows/test.yml`, unconditional on push + PR) instead of a per-slice dedicated agent. (The `pre-push-verifier` hook only checks for a recent PASS validation artifact — behind a default-off `push-verify` flag — and does not itself run the suite; CI is the actual full-suite safety net.)

**Risk-gated exception — dispatch `crew:verifier`** when ANY of:

- slice frontmatter `risk: high`, OR
- FEAT tags include `concern:security` or `concern:performance`, OR
- `SPLIT_BUILD = true`

On this path `crew:verifier` runs concurrently with the (possibly fanned-out — see `fan-out-review`) reviewer(s) and owns the mandatory full gate for that slice, per the Step 5 prompt in `commands/orchestrate-slice.md`.

The only validation gate that may be recorded as skipped on the risk-gated path is one explicitly recorded via a `crew:document-writer` dispatch with `badge: validation_skipped` + `reason: <text>` (e.g. environment unavailable) — never an implicit skip on "tests already green".

## Done

Validator gate decision is complete when:

- `RISK_GATE` (Step 4.5 of `commands/orchestrate-slice.md`) has been computed before the reviewer/verifier dispatch
- `crew:verifier` was dispatched when `RISK_GATE = true`, and skipped (validation delegated to `satisfiedByReview`) when `RISK_GATE = false`
- any skip on the risk-gated path has been explicitly recorded via `crew:document-writer` with `badge: validation_skipped` + `reason: <text>`
- implicit skips on "tests already green" have been avoided
