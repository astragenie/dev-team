---
description: Preferred short entry point for running the review phase on completed work.
---

# Review In The Lead Workflow

This is the preferred short entry point for the review phase.

Use it when code-bearing work or a substantial non-code deliverable is complete and needs independent review.

For what counts as "substantial" below, see the canonical definition in `constitution.md` (`What "Substantial" Means`).

Expected shape:

1. verify the current workspace path with `pwd`
2. read the repo wake-up brief:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" wake-up --repo "$PWD"`
3. explicitly confirm the returned `repoPath` matches the current working directory before trusting the brief
4. read the most relevant run and handoff context for the work under review:
   - latest run brief
   - latest relevant handoff
   - latest relevant review if one already exists
5. identify the completed work or artifact set under review
6. identify the standards that must be applied:
   - repo review policy
   - repo `CLAUDE.md` expectations
   - any repo-configured or globally configured review skills and standards that apply
     6a. preload builder context (build bundle): resolve the current slice id from `.claude/state/crew/workflow-state.json` (`currentRun.slice`) and call:
   - `node -e 'import("./scripts/lib/build-bundle/inline.ts").then(m => m.inlineLatestBundle({ sliceId: process.argv[1] })).then(s => process.stdout.write(s))' "<SLICE-NN>"`
     If the returned string is non-empty, include it verbatim in the reviewer dispatch prompt **before** the role-specific task body. If empty, dispatch the reviewer without preload (today's behavior) — bundle inline is non-blocking. The header inside the bundle (`## Builder context (preloaded — do not re-Read these files)`) is your signal to the reviewer that those files do not need to be re-Read.
7. dispatch the **`crew:reviewer`** agent for the independent review gate. Pass it: the diff or branch under review, the relevant run brief / handoff context, any applicable design doc path under `.claude/artifacts/crew/designs/` (so the reviewer can check conformance to the agreed design instead of inventing a spec from the diff), and which repo + global standards to apply. If no design doc applies, tell the reviewer "no design doc" explicitly. Do **not** dispatch `code-reviewer` or any other generically-named review agent here — those are scoped to ad-hoc spot-checks and do not honor the Crew review-artifact contract.
8. run the relevant review gates for the task and repo (the dispatched `crew:reviewer` owns this; the dispatcher supervises and synthesizes its output)
   - **Reviewer fan-out watchdog (dev-team#199).** This applies whenever more than one reviewer is dispatched for the same work (e.g. a stack reviewer alongside `crew:reviewer`, matching `commands/build.md` / `commands/fix.md`'s parallel fan-out): if one reviewer is idle with no artifact after the other has already returned, send one `SendMessage` status-check nudge. If still silent, mark `blocked` (`mark-badge --badge blocked --note "reviewer <name> idle with no artifact after nudge"`) and proceed under single-reviewer policy rather than waiting indefinitely.
   - **Idle-ping guidance:** an `idle_notification` ping from a reviewer that already delivered its artifact is noise, not a signal to act on — do not re-dispatch or nudge on it.
9. record the review result and update workflow state immediately when review completes
10. return findings, risks, standards checked, configured review skills used, and the next recommended step

Review should be treated as a phase, not a courtesy:

- substantial non-code deliverables should normally be reviewed before they are treated as done
- if code changed, independent review is required unless explicitly skipped with a reason
- the reviewer should be independent from the implementing agent
- the review may include correctness, regressions, scope discipline, test gaps, repo standards, language-specific checks, or security review
- do not leave repo standards or language standards implicit in the review summary

When review materially completes, write the review artifact:

- `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-review-result --repo "$PWD" --title "<short title>" --decision <approved|approved_with_notes|rejected> --author-id <builder-agent> --judge-id <reviewer-agent> --summary "<verdict>" --evidence "<files checked>" --files "<files in diff>" --test-summary "<test coverage>" --risks "<risks or none>" --next "<follow-up or none>"`

If review is intentionally skipped, record that explicitly in workflow state:

- `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge review_skipped --note "<reason>"`
