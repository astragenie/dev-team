---
id: FEAT-023
title: Hard-gate test_adequacy in write-review-result + TDD enforcement
priority: P1
status: done
category: quality-gate
target_release: 0.3.4
autonomous_safe: true
parent_spec: null
phase: 1
github_issue: 27
github_milestone: 1
github_url: "https://github.com/sergeymilashico/hero-crew/issues/27"
---
# FEAT-023 — Hard-gate test_adequacy in write-review-result + TDD enforcement

## Why

Downstream loop-plugin customer reported (2026-05-24) four compounding quality failures in their SLICE-92:
1. TDD rule in CLAUDE.md ignored by builder — no machine enforcement.
2. Slice file had literal `AC-N: ...` placeholder bullets — slice-from-feature never required them filled.
3. Review artifact passed but `Test Adequacy`, `Files Reviewed`, `Risks` rendered as `-`. Review only covered a fixup commit.
4. Marathon-mode auto-closed slices on "build + review passed" without inspecting test-adequacy signal.

Root cause: TDD + test-adequacy are soft conventions in agent prompts. `write-review-result` had no `--test-summary` flag at all; the renderer's `Test Adequacy` field has always been `-` for every artifact this CLI has ever written.

## Scope (this repo)

- `scripts/crew.mjs` — add `--test-summary`, `--test-summary-skip-reason`, `--non-code` flags; hard-gate the handler to exit 2 on approved code-bearing reviews missing all three.
- `scripts/lib/artifacts.mjs` — render the new fields in the review-result artifact.
- `agents/reviewer.md` — extend FEAT-011 TDD gate with the new CLI contract.
- `docs/ai-loop/00-entry/SLICE_TEMPLATE.md` — concrete-or-fail AC language + explicit test-coverage AC bullet + Done When line requiring populated Test Adequacy.
- `docs/routing-table.md` — new TDD / test-adequacy enforcement row.
- `test/crew-write-review-result.test.mjs` — five-scenario gate coverage (TDD-first).

## Out of scope

- Retroactive backfill of `Test Adequacy` in the 5 existing review artifacts (forward-only).
- `loop:slice-grade-write` enforcement (deferred until upstream gate is in place).
- Builder-side PreToolUse hooks (rejected under FEAT-022 / D1).
- Customer's SLICE-92 recovery (customer-side action).

## Acceptance criteria

- [ ] AC-1: `write-review-result --decision=approved` without `--test-summary` / `--test-summary-skip-reason` / `--non-code` exits 2 with stderr containing "refused" and "--test-summary".
- [ ] AC-2: Same invocation with any one of the three escape flags writes an artifact whose body reflects the chosen flag (`Test Adequacy: …`, `Test Adequacy Skip Reason: …`, or `Non-Code Review: yes`).
- [ ] AC-3: `--decision=rejected` bypasses the gate.
- [ ] AC-4: All five tests in `test/crew-write-review-result.test.mjs` pass + the full existing test suite is unaffected.
- [ ] AC-5: Full CI suite (`npm run lint`, `format:check`, `typecheck`, `validate-manifests`, `validate-skills`, `node --test`, `e2e-smoke`) is green.
- [ ] AC-6: tests cover all new public behavior — `test/crew-write-review-result.test.mjs` named with the five scenarios from the plan §7.

## Done When

- All AC PASS with evidence.
- Crew `review-result` artifact written by `crew:reviewer` with `Test Adequacy` populated (dogfooded — first reviewer artifact to use the new flag).
- Crew `final-synthesis` written.

## Related

- Customer report root-cause: 4-driver findings above.
- Plan: `~/.claude/plans/federated-wobbling-frog.md`
- Cross-repo follow-up: FEAT-024.
