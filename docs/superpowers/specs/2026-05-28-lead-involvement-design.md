# Lead Agent Involvement Design

- Date: 2026-05-28
- Status: approved
- Feature area: `commands/build.md`, `commands/fix.md`, `(removed v0.41)`

## Overview

Extends the dispatcher agent's role in `build` and `fix` commands from pure coordinator to active scope-and-quality enforcer via two hard procedure steps: a **scope gate** before the builder is dispatched, and a **diff gate** after the builder returns. Both gates live as explicit steps in the command procedures, making them enforceable rather than advisory. Both have defined skip paths for cases where gate cost exceeds benefit.

No new files. No routing-table changes. No new scripts.

## Architecture

```
build/fix procedure
  │
  ├─ [framing steps 1-4]
  │
  ├─ STEP 5: SCOPE GATE (lead)
  │     3 questions: scope correct? split needed? collision risk?
  │     → proceed | scope_gate_skipped badge
  │
  ├─ [mode choice + builder dispatch steps 6-13]
  │
  ├─ STEP 14: DIFF GATE (lead)
  │     reads: git diff --stat + ≤3 changed files
  │     → proceed | route back to builder (1 retry) | fix inline (≤2 lines) | escalate
  │     → diff_gate_skipped badge for exempt cases
  │
  └─ [review_required badge + remaining steps 15-end]
```

## Components

### `commands/build.md` — 2 new steps

**Step 5 — Scope gate (insert before current step 5 "Choose mode")**

Before choosing single-session or team-run mode, the dispatcher answers three questions:

1. Does the described scope match the task as framed? If not, restate and confirm with user.
2. Should this be split into smaller, independent tasks? If yes, stop and split.
3. Are there collision risks with files other agents or worktrees are currently touching? If yes, flag and resolve.

If all three pass: proceed to mode choice.
If any triggers a change: record the change, re-state scope, then proceed.
Skip path: `mark-badge scope_gate_skipped --note "<reason>"` — valid when scope was explicitly pre-negotiated in the same session, or the task is a single-file hotfix with no ambiguity.

**Step 14 — Diff gate (insert after current step 14 "Builder reports complete")**

After the builder reports complete and before writing the `review_required` badge, the dispatcher reads the diff:

```
git diff --stat HEAD~1..HEAD
```

If ≤3 files changed, also read those files' changed sections.

Outcomes:
- **Proceed**: diff matches stated scope, no surprises → continue to `review_required`.
- **Route back to builder**: diff is out of scope, missing coverage, or contradicts the task → create `fix-builder` subagent with specific correction note. One retry allowed. On second fail: escalate.
- **Fix inline**: diff has 1-2 line issue the dispatcher can correct without re-dispatching (comment, whitespace, obvious typo) → fix inline, note in run brief.
- **Escalate**: diff reveals scope ambiguity that needs user input → `mark-badge escalated_to_human --note "<reason>"`, surface to user.

Skip path: `mark-badge diff_gate_skipped --note "<reason>"` — valid for: non-code deliverables (docs, specs), doc-only changes, diffs under 20 lines with no logic changes.

### `commands/fix.md` — 2 new steps (mirror of build.md)

Same scope gate at step 5 and diff gate at step 14, with fix-specific framing:
- Scope gate question 1 becomes: "Does the described fix address root cause, or only symptoms?"
- Diff gate inline-fix threshold stays ≤2 lines (same rule).

### `(removed v0.41)` — new "Quality gates" section

Adds a top-level section that documents both gates as judgment blocks for the dispatcher to apply in single-session mode (where command steps may not be followed mechanically):

```markdown
## Quality Gates

Two active enforcement points in every build/fix run:

**Scope gate** (before dispatching): challenge scope, check for split/collision.
**Diff gate** (after builder returns): read diff, verify it matches stated scope.

Skip only when cost exceeds benefit — document skips with `mark-badge`.
```

This covers single-session mode where the dispatcher does its own implementation rather than dispatching. The gate logic is the same; the target is `self` rather than a builder subagent.

## Data Flow

```
User issues /crew:build or /crew:fix
  └─ Lead reads task + repo context
       └─ SCOPE GATE
            ├─ pass → mode choice
            │    └─ builder dispatched
            │         └─ DIFF GATE
            │              ├─ pass → review_required badge → reviewer
            │              ├─ route-back → builder (retry 1)
            │              │    └─ DIFF GATE again
            │              │         ├─ pass → review_required badge
            │              │         └─ fail → escalate_to_human
            │              ├─ inline fix → proceed
            │              └─ escalate → escalate_to_human badge
            └─ scope_gate_skipped badge → mode choice (no scope check)
```

Badge states produced by these gates: `scope_gate_skipped`, `diff_gate_skipped`, `escalated_to_human`. No new badge types.

## Error Handling

**Scope gate — bad scope detected:**
Lead restates corrected scope and re-confirms with user before proceeding. Does not dispatch builder until scope is clean. If user is unavailable (autonomous loop), log discrepancy in run brief and proceed with original scope flagged.

**Diff gate — builder route-back:**
Lead creates a bounded correction subagent with specific note: what was wrong, what is expected. Retry count tracked in run brief. After one retry, if diff still fails gate, lead escalates to human rather than looping further. This prevents unbounded retry loops.

**Diff gate — escalation:**
Lead writes `escalated_to_human` badge with explicit note. `write-final-synthesis` refuses to run while escalated (existing harness behavior). User must resolve and clear the badge before loop continues.

**Skip abuse guard:**
No automated enforcement. Review gate will catch if diff shows scope drift that a skip concealed — diff gate skip does not skip the reviewer.

## Testing

**Manual smoke (primary):**
1. Run `/crew:build` on a task with ambiguous scope — verify scope gate fires and asks the 3 questions.
2. Run `/crew:build` on a clear single-file task — verify `scope_gate_skipped` badge appears with note (if skipped) or gate passes silently (if not skipped).
3. Arrange a builder that returns out-of-scope diff — verify diff gate routes back with correction note.
4. Arrange a doc-only change — verify diff gate is skipped, `diff_gate_skipped` badge written.

**Regression check:**
After implementing, run `npm test` and `npm run e2e:smoke`. Gate steps are procedure text, not runtime code, so no unit test surface. Existing CI gates still apply.

**Acceptance criteria:**
- Scope gate appears as explicit step in `build.md` and `fix.md` between framing and mode-choice.
- Diff gate appears as explicit step after builder-complete, before `review_required` badge.
- `(removed v0.41)` has a "Quality gates" section covering both.
- Skip paths documented with valid conditions and badge name.
- No new files created.
- Existing test suite green.
