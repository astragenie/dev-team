---
phase: "review"
feature: issue-187-174-wave3-guard1
status: completed
decision: rejected
review_decision: NEEDS_FIX
author_id: crew:fullstack-dev
judge_id: crew:reviewer
self_approval: false
---
# Review Result: dev-team PR #225 — Wave 3 Guard 1 (builder terminal-state SubagentStop guard)

- Created: 2026-07-12T21:12:13Z
- Reviewer: crew:reviewer (independent, read-only)
- Decision: **NEEDS_FIX**
- Repo: `C:\work\mega\dev-team`, PR #225, base `main`, head `pr-225-review` (fetched `refs/pull/225/head`, worktree at `C:\Users\serge\AppData\Local\Temp\pr225-review`)

## Headline finding (blocks merge)

**The guard blocks 100% of `crew:dev-lite` completions, including well-formed successes and legitimate refusals, because `dev-lite`'s own documented Report contract (`agents/dev-lite.md:86-106`) never uses the `DONE:`/`BLOCKED:`/`HELP:`/`IN-PROGRESS:` vocabulary this hook checks for.**

- `agents/dev-lite.md:88-96` — dev-lite's actual success format is:
  ```
  <path:line-range> — <change ≤10 words>.
  verified: <re-read OK | mismatch @ path:line>.
  ```
  and its refusal vocabulary (`agents/dev-lite.md:100-106`) is `too-big.`, `over-loc.`, `public-surface:`, `escalate:`, `needs-confirm.`, `ambiguous.`, `regressed.` — none of these start a line with `DONE`/`BLOCKED`/`HELP`/`HELP-REQUEST`/`IN-PROGRESS` followed by `:`, and dev-lite never writes a `.claude/artifacts/crew/*` path (`"Receipt IS the artifact."`, line 88). So neither `hasTerminalStatusMarker` nor `hasArtifactPath` can ever match a genuine dev-lite turn.
- Independently reproduced against the actual PR code (not a hypothetical): ran `runCheckBuilderTerminalStateHook` from `hooks/lib/check-builder-terminal-state.ts` in the fetched worktree with `agent_name: "crew:dev-lite"` and two realistic messages lifted verbatim from dev-lite's own template —
  - `"hooks/foo.ts:12-15 — fixed typo in comment.\nverified: re-read OK."` → **BLOCKED**
  - `"too-big. split: 1) rename in A.ts 2) rename in B.ts 3) rename in C.ts."` → **BLOCKED**
- Root cause: `BUILDER_TIER_AGENTS` (`hooks/lib/model-routing-enforce.ts:38-44`) was built for model-routing scope (which model to inject on dispatch) and reused verbatim for this guard's scope per the design doc's "import, don't redeclare" instruction (§1, `hooks/lib/check-builder-terminal-state.ts:29`) — correctly, per that instruction. But the design never checked whether all five agents in that list share a compatible terminal-status vocabulary. Four do (`fullstack-dev`, `backend-dev`, `frontend-dev`, `aiplugin-dev` all template `<STATUS>: <headline>` with `STATUS ∈ {DONE, BLOCKED, HELP, IN-PROGRESS}` — confirmed at `agents/fullstack-dev.md:204-211`, `agents/backend-dev.md:266-269`, `agents/frontend-dev.md:194-196`, `agents/aiplugin-dev.md:229`). `dev-lite` does not, by design — it's the "surgical mechanical editor" whose entire value proposition is a maximally compressed receipt (`"Nothing else. No diff dump, no rationale, no plan."`, `agents/dev-lite.md:96`).
- Effect: every `crew:dev-lite` dispatch, in every consumer repo, by default (`builder-terminal-state-guard` ships `default: true`), now eats one mandatory block-and-retry cycle — the exact opposite of dev-lite's purpose (cheapest possible dispatch). Worse, the block's own remediation text ("Emit a `DONE:`/`BLOCKED:`/... line") instructs dev-lite to violate its own prompt's "Nothing else" contract to escape the guard. This is a functional regression shipping to every consumer repo on merge, not an edge case — it fires on every single dev-lite turn, not a rare malformed-input path.
- The new test suite does not catch this: `tests/check-builder-terminal-state.test.ts`'s only dev-lite case (`"missing crew.json → ... still blocks"`) uses the synthetic message `"Done editing."`, which is *also* incomplete under the general-tier rule — so the test's assertion (block) is accidentally correct for that input, but it never exercises dev-lite's actual documented report format, so it can't reveal that *every real* dev-lite output is treated the same way.
- This is the same class of risk flagged for AC2 (a legitimate terminal state getting blocked) at a wider scope — the fix should either (a) exclude `dev-lite` from this guard's agent set, or (b) extend the detector to also recognize dev-lite's receipt/refusal vocabulary as delivered. Both are small, targeted fixes; recommend (a) given dev-lite's format is deliberately terse and not really a "STATUS ∈ {...}" contract at all.

## What I verified (not just asserted)

1. **AC2 guardrail — confirmed correct for the four STATUS-line agents.** `hasDeliveredTerminalState` (`hooks/lib/check-builder-terminal-state.ts:23-25`) is `!detectSubagentIncomplete({body: message})`, which OR's `hasArtifactPath` and `hasTerminalStatusMarker` (`scripts/lib/subagent-return/incomplete-detector.ts:43-48`). `TERMINAL_STATUS_RE = /^(DONE|BLOCKED|HELP|HELP-REQUEST|IN-PROGRESS)\s*:/im` (`incomplete-detector.ts:19`) matches a line starting with `BLOCKED:` — verified against the real fullstack/backend/frontend/aiplugin-dev template (`<STATUS>: <headline>`, e.g. `agents/fullstack-dev.md:204-209`), not just the design doc's prose shorthand. `STATUS: BLOCKED — <reason>` is a paraphrase in the design doc; the actual wire format is `BLOCKED: <reason>` and the regex matches it correctly. Independently confirmed via test `"builder-tier stop with a BLOCKED: line → pass"` in `tests/check-builder-terminal-state.test.ts` and by re-running the full 11/11 file myself (`bun test tests/check-builder-terminal-state.test.ts` → 11 pass, 0 fail, in the fetched worktree).
2. **Fail-open completeness — all four paths confirmed by reading the code:**
   - `stop_hook_active === true` → `if (stop_hook_active) return null;` (`check-builder-terminal-state.ts:74`), before any other check.
   - Malformed JSON / missing `agent_name` → `parseInput` returns `null` on JSON parse failure (`check-builder-terminal-state.ts:52-53`); `agent_name === null || !isBuilderTierAgent(...)` → pass (`check-builder-terminal-state.ts:76`).
   - `last_assistant_message` absent → `message === null` branch logs and returns `null` (`check-builder-terminal-state.ts:80-88`), never guesses.
   - Shim-level try/catch: `hooks/check-builder-terminal-state.ts:29-31` — `main().catch(...) → logHookError(...); process.exit(0);`.
3. **Scope containment — confirmed via import, not redeclaration.** `hooks/lib/check-builder-terminal-state.ts:29` imports `isBuilderTierAgent` from `hooks/lib/model-routing-enforce.ts` (not a copy of `BUILDER_TIER_AGENTS`). That helper internally references the same frozen `BUILDER_TIER_AGENTS` array and the same `crew:`-prefix-stripping normalization `model-routing-enforce.ts` already uses for the PreToolUse Agent-tool hook — this is arguably *better* reuse than importing the raw array, since it keeps normalization logic in one place. `hooks/lib/check-reviewer-decision.ts` (reviewer-tier, `REVIEWER_TIER_AGENTS`) is untouched by this diff — confirmed by `gh pr diff 225`, no changes to that file.
4. **Reuse, not reimplementation — confirmed.** `hasTerminalStatusMarker` / `detectSubagentIncomplete` imported verbatim from `scripts/lib/subagent-return/incomplete-detector.ts`; `hasArtifactPath` imported verbatim from `scripts/lib/subagent-return/check.ts`. The only new logic is `hasDeliveredTerminalState`, a one-line negation wrapper — not a hand-rolled parser. No drift risk from a second STATUS-line regex.
5. **`hooks.json` additivity — confirmed.** Diff shows exactly one new object appended to the existing `SubagentStop` array (`hooks/hooks.json:55-61` pre-PR → 4-entry array post-PR); `log_event.sh`, `otel-subagent-stop.ts`, and `check-reviewer-decision.ts` entries are byte-identical, untouched.
6. **Feature flag — confirmed.** `builder-terminal-state-guard` added to `FEATURES` (`scripts/lib/features-service.ts:135-143`) with the same shape as `reviewer-decision-guard` (`features-service.ts:127-135`): `version`/`default: true`/`description`/`scope`/`owner`/`since`. Gated through the shared `isEnabled(feature, config)` helper (`check-builder-terminal-state.ts:77`) — no hook-local bypass. `isEnabled`'s documented default-on-missing-key behavior (`features-service.ts:148-186`) confirmed by reading the implementation.
7. **Test honesty — plausible, independently corroborated.** Fetched the PR branch into a fresh worktree; `node_modules` is genuinely absent there (matches the builder's stated repro condition). Ran `tests/check-builder-terminal-state.test.ts` myself: **11 pass, 0 fail** — matches the claimed count. Did not re-run the full 1872-test suite (would require `npm ci`/`bun install` in this read-only review pass), so the "3 pre-existing environment-only failures" claim is corroborated by matching preconditions (missing `node_modules`, and `tests/telemetry-plugin-cache-smoke.test.ts`'s own header explicitly describes a node_modules-copy-dependent smoke test) rather than independently re-executed. No red flags found in that test file that would suggest the failures are actually a regression from this diff — the new PR doesn't touch anything in the telemetry/otel path.

## SubagentStop hook-stacking gap — judgment

**Acceptable to merge Guard 1 alone.** This hook is currently the *only* builder-tier `SubagentStop` hook (`check-reviewer-decision.ts` is reviewer-tier only). Hook-stacking order/short-circuit behavior only matters once a second builder-tier `SubagentStop` hook exists to race against — which is exactly what the design doc's own §6 resolution says ("Guard 3 does not start until this is known"). The documentation-sourced evidence (two independent sources agreeing hooks don't short-circuit) is adequate for *this* PR's risk profile because there is nothing for it to stack against yet. **This gap should block Guard 3, not this PR** — flag it as a hard precondition on Guard 3's own review, not a debt this PR is carrying.

## Recommendation

**NEEDS_FIX.** Everything reviewed for the stated AC2/fail-open/scope/reuse/additivity/flag concerns passed verification against the actual code, not just the PR's claims. But the `dev-lite` scope mismatch is a confirmed, reproducible functional regression that fires on every dev-lite dispatch in every consumer repo by default starting at merge — the exact "wedges every build" risk class this review was asked to weigh with particular force. Recommend: exclude `dev-lite` from `builder-terminal-state-guard`'s scope (smallest fix — the agent's report contract is intentionally not STATUS-line-shaped) or extend the detector for dev-lite's vocabulary, plus a regression test using dev-lite's actual documented receipt format as a positive control (mirroring the `DONE:` positive control already present for the other four agents). Everything else in this PR is solid and can ship unchanged once that scope gap is closed.

- Evidence Checked: `gh pr diff 225`, `hooks/lib/check-builder-terminal-state.ts`, `hooks/check-builder-terminal-state.ts`, `hooks/hooks.json`, `scripts/lib/features-service.ts`, `scripts/lib/subagent-return/incomplete-detector.ts`, `scripts/lib/subagent-return/check.ts`, `hooks/lib/model-routing-enforce.ts`, `hooks/lib/check-reviewer-decision.ts`, `agents/dev-lite.md`, `agents/fullstack-dev.md`, `agents/backend-dev.md`, `agents/frontend-dev.md`, `agents/aiplugin-dev.md`, live test run in fetched worktree (`bun test tests/check-builder-terminal-state.test.ts` → 11/11 pass), live repro script against `runCheckBuilderTerminalStateHook` with dev-lite's real report format.
- Files Reviewed: `.claude/artifacts/crew/designs/2026-07-12-subagent-lifecycle-guards.md`, `docs/standards/agent-playbook.md`, `hooks/check-builder-terminal-state.ts`, `hooks/hooks.json`, `hooks/lib/check-builder-terminal-state.ts`, `scripts/lib/features-service.ts`, `tests/check-builder-terminal-state.test.ts`.
- Test Adequacy: 11/11 new tests pass (independently re-run); coverage gap identified — no positive-control test for dev-lite's actual report format (see headline finding).
- Author: crew:fullstack-dev
- Judge: crew:reviewer
- Risks: dev-lite scope mismatch ships to every consumer repo by default on merge; SubagentStop-stacking evidence is documentation-sourced, not empirically re-verified (acceptable for this PR, not for Guard 3).
- Required Follow-up: exclude `dev-lite` from `builder-terminal-state-guard` scope (or extend detection for its vocabulary) + add a dev-lite-format positive-control test, before re-submitting for merge.
