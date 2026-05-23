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
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" wake-up --repo "$PWD"`
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
7. dispatch the **`crew:reviewer`** agent for the independent review gate. Pass it: the diff or branch under review, the relevant run brief / handoff context, and which repo + global standards to apply. Do **not** dispatch `caveman:cavecrew-reviewer`, `code-reviewer`, or any other review agent here — those are scoped to ad-hoc spot-checks and do not honor the Crew review-artifact contract.
8. run the relevant review gates for the task and repo (the dispatched `crew:reviewer` owns this; the lead supervises and synthesizes its output)
9. record the review result and update workflow state immediately when review completes
10. return findings, risks, standards checked, configured review skills used, and the next recommended step

Review should be treated as a phase, not a courtesy:

- substantial non-code deliverables should normally be reviewed before they are treated as done
- if code changed, independent review is required unless explicitly skipped with a reason
- the reviewer should be independent from the implementing agent
- the review may include correctness, regressions, scope discipline, test gaps, repo standards, language-specific checks, or security review
- do not leave repo standards or language standards implicit in the review summary

When review materially completes, write the review artifact:

- `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" write-review-result --repo "$PWD" --title "<short title>" ...`

If review is intentionally skipped, record that explicitly in workflow state:

- `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" mark-badge --repo "$PWD" --badge review_skipped --note "<reason>"`
