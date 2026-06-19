---
name: fix-pr
prompt_id: fix-pr
version: 1.0.0
tier: workflow
description: Fetch unresolved review comments on the current branch's pull request and address each one in order. Use when a reviewer has left actionable feedback on an open PR and the next step is to apply fixes + push.
owner: astra
last_reviewed: 2026-05-23
triggers: ["fix PR comments", "address review feedback", "unresolved comments", "reviewer left feedback", "rework PR"]
---

# Fix PR

Address unresolved reviewer comments on the current branch's open pull request, end-to-end.

## When to Use

- A reviewer has commented on the current branch's PR and the comments are unresolved.
- The user asks to "fix PR comments" / "address review feedback" / "rework the PR".
- Before merging — confirm there are no unresolved blocking comments first.

## When **not** to Use

- No PR exists yet — open one via `gh pr create` first.
- Comments are informational only (no action requested) — record the decision, do not change code.
- Comments request architectural rework that would silently exceed scope — escalate to lead, do not act unilaterally.

## Workflow

### 1. Locate the PR

```bash
gh pr view --json number,url,title,state
```

Confirm: state = `OPEN`, branch matches `git rev-parse --abbrev-ref HEAD`. If multiple PRs reference the branch, halt and ask the user which one.

### 2. Fetch unresolved comments

```bash
gh pr view --comments
```

Or for richer detail (inline review comments included):

```bash
gh api repos/:owner/:repo/pulls/$(gh pr view --json number -q .number)/comments
```

Filter for unresolved threads. A thread is resolved if `resolved: true` (in the review comments API) or visually marked as resolved in the PR UI.

### 3. Classify each comment

For each unresolved comment:

- **must-fix** (correctness, security, regression risk) — apply.
- **should-fix** (style, naming, clarity) — apply unless cost outweighs benefit; document the decision in a reply if skipping.
- **nit** (preference) — apply if cheap, skip if expensive; reply with the reasoning.
- **question** (reviewer wants clarification) — answer in a reply, no code change.
- **out-of-scope** (asks for work beyond the PR) — escalate; open a follow-up issue or FEAT entry, link from the reply, do not bloat the PR.

### 4. Apply fixes in order

Group fixes by file + concern. Make focused commits per group — see [commit skill](../commit/SKILL.md). Avoid one mega-commit titled "address PR feedback" — it loses the reviewer audit trail.

For each fix:

1. Make the change.
2. Re-run the relevant test (`bun test --parallel` for full; targeted file for fast feedback).
3. Commit with a message referencing the comment if non-obvious (`fix: address reviewer note on ...`).

### 5. Reply on every thread

Even on threads where you applied the fix without modification, leave a reply: `Fixed in <commit-sha>.` Threads with no reply look ignored.

For skipped / deferred comments, reply with the reasoning + link to the follow-up issue if applicable.

### 6. Push and request re-review

```bash
git push
gh pr ready  # if it was draft
gh pr edit --add-reviewer <username>  # re-request review
```

### 7. Verify before declaring done

- All unresolved threads now have a reply.
- CI passes on the new HEAD.
- No new unresolved threads opened by the reviewer in the interim.

## Pitfalls

| Anti-pattern | Why bad |
|---|---|
| Squash-and-force-push to "tidy up" | Destroys reviewer's diff context; they re-review from scratch. Only squash on merge, not during review. |
| Reply "done" on threads without a commit SHA | Reviewer cannot verify; reopens the cycle. Always link the commit. |
| Apply all fixes in one commit | Loses per-comment audit trail. Group by concern. |
| Ignore "out-of-scope" suggestions silently | Reviewer thinks you missed it; relationship erodes. Reply with the follow-up issue link. |
| Re-request review while CI is failing | Wastes the reviewer's slot. Wait for green CI. |

## Repo specifics

- CI gate (`.github/workflows/test.yml`) must be green before re-request. Eight gates: `validate-manifests`, `validate-skills`, `lint`, `format:check`, `typecheck`, `bun test --parallel`, `e2e-smoke`, `npm ci`.
- Pair with the [commit skill](../commit/SKILL.md) for per-fix commit messages.
- For substantial scope changes flagged by the reviewer, escalate via `/crew:request-approval` rather than absorbing silently.

## Done / Stop-when

- Every unresolved thread has either a fix commit linked in a reply OR a recorded reason for skipping.
- CI is green on the new HEAD.
- Re-review requested (or merge-ready, if no further review is required).
- No comment was silently ignored.

## Attribution

Authored fresh for this repo. Concept (one-line "fetch PR comments and fix them") observed in many open-source `.claude/commands/` files including `metabase/metabase` and `evmts/tevm-monorepo`; this skill body shares no copied text with any of them.
