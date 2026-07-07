---
name: builder-ceremony
prompt_id: builder-ceremony
version: 2.3.0
tier: workflow
model_pinned: sonnet
maxLines: 250
description: Builder slice-boundary discipline — inline task return format, workflow badges, pre-completion secret grep, scope-cross fallback, context-ceiling escalation, atomic commit rule, structural deviation rule, time budget. Loaded by backend-dev / frontend-dev / fullstack-dev / aiplugin-dev so the builder prompts focus on the JOB. Inline-only: no handoff artifacts, no bundles, no stubs.
triggers: ["badge", "secret grep", "scope-cross", "context ceiling", "primary return contract", "inline return", "scope-cross fallback"]
---

# Builder ceremony — inline return + gates + badges

Builders return inline. No handoff artifacts, no bundles, no stubs. Reviewer reads `git diff` + your STATUS/Files/Risks/Next directly. This skill carries the slice-boundary protocol that changes rarely but matters every time.

Exception (dev-team#174): a `[checkpoint]` system-message nudge from the checkpoint-cadence hook asks you to write a gitignored resume scaffold at `.claude/state/crew/checkpoint-<slice-id>.md`. That state file is NOT a handoff artifact (never under `.claude/artifacts/crew/handoffs/`, never via `write-handoff`) — write it when nudged; the inline-only rule still bars handoff artifacts/bundles/stubs.

## Trigger

Load at slice boundaries:
- Completion (final return)
- Blocker / escalation / help / skipped gate (any badge emission)
- Scope-cross discovery
- Context ceiling

Trivial single-line / typo / mechanical-rename tasks skip the ceremony.

## Workflow badges

Emit BEFORE returning when an external blocker, escalation, or skipped gate applies. Badge surfaces in `brief-me` + `wake-up`; your inline Risks line carries the detail.

```bash
: "${CLAUDE_PLUGIN_ROOT:?must be set}"

# External blocker (missing decision, API down, scope boundary crossed)
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge blocked --note "<reason>"

# Escalate when a decision is beyond agent judgment
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge escalated_to_dispatcher --note "<reason>"

# Help when a peer dispatch can't unblock you
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge help_request --note "<reason>"

# Skipped validation gate (when you own that decision)
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge validation_skipped --note "<reason>"
```

No badge required when STATUS = `DONE` and no exceptions apply.

## Pre-completion secret grep

Before returning, scan your diff:

```bash
git diff "$SLICE_BASE" -- ':(exclude)*.lock' | grep -E -i '(api[_-]?key|secret|password|token|AKIA[0-9A-Z]{16}|sk-[a-zA-Z0-9]{20,})='
```

Match → halt + `mark-badge blocked --note "secrets in diff"`. False positives → `# pragma: allowlist secret` on the line + document in Risks.

## Self-verify gate

Run `skills/workflow/self-verify-gate/` before return. FAIL → BLOCKED. Verifier picks up SKIPPED / TIMEOUT.

## Band-aid mini-contract (always-on)

You carry this rule even when `root-cause-discipline` isn't loaded:

- No band-aids without `Risks` surface.
- Bug fixes + test failures + flakes + regressions → STOP and load `skills/workflow/root-cause-discipline/` before patching.
- Never swallow errors silently, disable tests, bump timeouts / caps to defeat a gate, or hardcode fallbacks that mask the real failure mode.
- Patch necessary → `band-aid: <patch>: root cause = <X>` in Risks + named follow-up.

Full anti-pattern taxonomy + investigation procedure: load `skills/workflow/root-cause-discipline/` on debugging work only.

## Primary return contract

Every builder dispatch returns this shape — no exceptions for completed work:

```
<STATUS>: <one-sentence headline>
Files: <comma-separated paths or "(none)">
Risks: <issues / band-aid surface / scope-cross | "none">
[Next: <follow-up id or dispatch hint>]
```

Status tokens (all-caps): `DONE` / `BLOCKED` / `HELP` / `IN-PROGRESS`. 2-5 lines total. Longer = compress.

**Structured returns are for machines.** Keep headlines concise — name what + where, no narrative. Avoid prose preambles ("I investigated...", "Done, let me explain..."). The dispatcher parses this format; prose breaks routing.

### Examples

```
DONE: Fix typo in identity-anchor leak phrase list.
Files: agents/fullstack-dev.md
Risks: none
```

```
DONE: Add timeout guard around langfuse fetch.
Files: evals/lib/langfuse-emit.ts
Risks: band-aid: catch swallows non-404 errors; root cause = wrong endpoint
Next: endpoint detection follow-up
```

```
[badge: blocked]
BLOCKED: claude CLI not on PATH.
Files: (none)
Risks: which claude → not found
Next: install CLI or set PATH; rerun
```

```
[badge: help_request]
HELP: Contract drift on /users endpoint shape.
Files: api/users/handler.ts
Risks: OpenAPI says response.avatar string; impl returns object
Next: needs architect clarification
```

### Acceptance rules (reviewer)

| Field | Rule |
|---|---|
| STATUS | Present, all-caps, in {DONE, BLOCKED, HELP, IN-PROGRESS} |
| Headline | Names what + where; never "did stuff" |
| Files | Comma-separated paths OR `(none)` |
| Risks | Names issues / band-aid / scope-cross OR `none` |
| Next | Follow-up id or dispatch hint when applicable |
| Length | 2-5 lines |
| Band-aid surface | Use exact `band-aid: <patch>: root cause = <X>` form per `skills/workflow/root-cause-discipline/` |

## Scope-cross fallback (the only safe specialist routing)

Mid-slice discovery that work belongs to a different specialist (FE↔BE crossover, infra in a feature slice, UX ambiguity, contract gap): you CANNOT peer-dispatch the other builder — `backend-dev` ↔ `frontend-dev` ↔ `fullstack-dev` cross-dispatch is the most regression-prone pattern and is blacklisted.

Fallback sequence:

1. Stop at the slice boundary still in your scope. Finish what's legitimately yours.
2. `mark-badge blocked --note "scope-cross: <files>: needs dispatcher to dispatch <specialist> for <reason>"` (or append the same line to Risks).
3. Return STATUS = `BLOCKED` (or `DONE` if your portion completed) with the scope-cross flag visible.
4. Dispatcher reads + routes the recommended specialist on the remaining scope on the next cycle.

| Discovery during your work | Surface as |
|---|---|
| FE work (`*.tsx`, `*.css`, `src/components/`) in BE/generalist slice | `scope-cross: <files>: needs dispatcher to dispatch crew:frontend-dev` |
| BE service work (`*.cs` ASP.NET, deep API/DB) in FE slice | `scope-cross: <files>: needs dispatcher to dispatch crew:backend-dev` |
| Cross-layer work both BE + FE | `scope-cross: SPLIT_BUILD: <files>: dispatcher splits into BE-only + FE-only` |
| Infra / CI / deploy work | `scope-cross: <files>: needs dispatcher to dispatch crew:release-engineer` |
| UX design ambiguity blocking implementation | `scope-cross: needs dispatcher to dispatch crew:uxdesigner` |
| Architecture / contract clarification | `scope-cross: needs dispatcher to dispatch crew:architect` (or peer-dispatch architect if your whitelist allows mid-implementation) |

This is the ONLY safe path to specialist routing from a builder dispatch.

## Context ceiling

50 tool uses OR 100K context tokens before all ACs complete:

1. `mark-badge blocked --note "context_ceiling_reached: [list remaining ACs]"`
2. Return `IN-PROGRESS` with the remaining ACs listed in Risks.
3. Do NOT attempt inline recovery or partial commits for remaining ACs.
4. Dispatcher splits the remaining ACs into a fresh bounded task + dispatches a new builder.

## Commit policy

Default: never commit without explicit user request. Use `skills/workflow/git-commit/` for message authoring.

**`dev.stable: true` worktree carve-out** — commit autonomously when ALL of:
- `.claude/crew/deployment.md` has `dev.stable: true`
- On a feature branch or isolated git worktree (NOT `main` / `master`)
- Slice-scoped tests pass (the tests that exercise the changed files)
- No `help_request` badge open
- Pre-completion secret grep passed
- Local commit only — never tag, force-push, or production deploy

Typecheck / lint / format are advisory (deferred to dispatcher's review). When in doubt, defer to the dispatcher.

## Atomic commit rule (when dev.stable carve-out applies)

After each completed subtask, commit immediately. Do NOT batch commits at end-of-run.

A subtask = smallest logical unit that compiles + has scoped tests green in isolation. Examples by stack:

| Stack | Subtask example |
|---|---|
| TypeScript backend | One new function + its test, one renamed export across production + test |
| TypeScript frontend | One new component + its test, one hook refactor that compiles + passes scoped tests |
| C# backend | One new method + its test, one migration up + down green |
| Plugin (agents/skills/commands) | One new agent prompt validating green, one renamed skill directory with refs updated |

**Why:** if the dispatch is killed (tool-use cap, context exhaustion, user interrupt), every completed subtask is already on the branch. Re-dispatch picks up from the last commit — completed work never gets redone.

**Anti-pattern:** "I'll commit everything at the end after self-verify." When end-of-run never arrives (cutoff at 70% complete), 70% of work is lost. Commit incrementally and partial work survives every kill.

## Structural deviation rule

Slice spec contradicts repo state (DAG cycle, conflicting prior DEC-NNN, missing assumed dependency, nonexistent file path)? STOP. Emit `mark-badge blocked --note "structural-deviation: <what>"` and return `BLOCKED: structural-deviation in slice spec.` with `Risks: structural-deviation: <what contradicts>: proposed resolution: <X>` and `Next: dispatcher decides`. Never silently drop edges or invent workarounds outside scope.

## Conventions (universal)

- **TaskUpdate batching** — never run ≥3 back-to-back without intervening work. Hook `check-task-update-burst` logs evidence to `.claude/logs/task-update-bursts.jsonl`.
- **Coalesce Bash calls** — chain `cmd1 && cmd2 && cmd3` for pure data-collection. Separate only when each result drives the next decision.
- **Read once, trust** — once a file is read, don't re-Read in the same dispatch. Use `git diff` or scoped Grep to verify changes.
- **Batch per-file edits** — multiple Edits to the same file in one turn, not spread across the run.

## Time budget

- **Trivial** (typo, 1-line edit): ≤5 tool uses
- **Small** (single function + test, single component): ≤15 tool uses
- **Standard** (bounded feature slice): ≤40 tool uses
- **Wide** (cross-layer slice): ≤60 tool uses

Approaching cap → finish current subtask, commit, surface IN-PROGRESS in Risks with remaining ACs. Don't burn the last 10% trying to wrap up everything — commit and let re-dispatch finish.

## Done / Acceptance

You may return when:
- Self-verify gates show no FAIL (or you BLOCKED on the FAIL)
- Secret grep passed (or you BLOCKED on a match)
- Applicable badge emitted (or none applies for clean DONE)
- Inline return follows the Primary return contract
- No scope-cross discovered without surfacing in Risks
- No context-ceiling without IN-PROGRESS + remaining ACs in Risks
- Per-subtask commits made (atomic commit rule above)

Contract violation: returning narration ("Done, let me explain...") instead of the STATUS/Files/Risks/Next form. The structured return is the dispatcher's signal — prose breaks routing.
