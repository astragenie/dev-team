---
description: Preferred short entry point for investigating and fixing broken behavior in the current repo.
---

# Fix With The Lead Workflow

Act as the lead for a debugging run with strong observability and bounded parallelism.

For what counts as "substantial" below, see the canonical definition in `constitution.md` (`What "Substantial" Means`).

Workflow:

1. First verify the current workspace path:
   - `pwd`
2. Start by reading the repo wake-up brief:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" wake-up --repo "$PWD"`
3. Explicitly confirm the returned `repoPath` matches the current working directory. If it does not, stop and correct the repo context before proceeding.
   For substantial work, do not start implementation until this step is complete.
4. Follow this phase order:
   - frame
   - investigate
   - implement fix if needed
   - review if code changed
   - validate if the bug path or changed behavior can be exercised meaningfully
   - synthesize
5. Restate the bug and frame the task:
   - current symptoms
   - expected behavior
   - known evidence or likely repro path
   - what is in scope
   - whether the work should stay whole or be split into bounded sub-tasks
6. Choose one of:
   - `single-session`
   - `assisted single-session`
   - `team run`
7. If the investigation is substantial enough that future wake-up context will matter, immediately write a run brief with:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-run-brief --repo "$PWD" --title "<short title>" --goal "<goal>" --mode "<mode>"`
8. If using `single-session`, do the investigation directly and do not spawn helpers.
9. Use `assisted single-session` when a bounded helper can compare code paths, gather evidence, or validate a likely fix without becoming a communicating team.
10. Use a `team run` only when multiple independent hypotheses or surfaces can be investigated in parallel.
11. Typical `team run` split:
   - researcher traces code paths and prior behavior
   - builder attempts the smallest credible fix once the problem is clear
   - reviewer checks the code change for regression risk and test coverage
   - validator exercises the bug path and expected behavior when it can be run
12. Use claims only when multiple people may touch overlapping files, and use approvals only for destructive or scope-expanding decisions.
   - Set a `size` on each dispatched task: use `size: light` for trivial tasks (one-line fixes, typo corrections, variable renames) — a light-close skips the `write-handoff` artifact but the teammate still returns the structured completion message. Use `size: standard` (default) for anything substantive — these REQUIRE a `write-handoff` artifact. Light is for noise reduction on trivial work; do not use it to skip audit trail on substantive changes.
13. Require every teammate or helper to report scope, deliverable, evidence, risks, confidence, and next handoff.
   After a subagent completes, read its full report from the artifact path it returned (via `Read` on the handoff path). Do NOT treat the inline return as the full report — agents return only path + headline by contract.
14. If the work produces a code fix, make that code-bearing change independently reviewable. Review should happen before the fix is treated as complete.
15. Substantial non-code deliverables should normally be reviewed before being treated as done.
16. For code fixes, independent review is the default. When code work is complete and waiting for review, record that gate in workflow state:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge review_required`
17. If you skip review, say so explicitly and record it in workflow state with a reason:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge review_skipped --note "<reason>"`
18. When a helper or teammate returns meaningful evidence or ownership changes, write a handoff artifact if the run is substantial:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-handoff --repo "$PWD" --title "<short title>" --from <role> --to lead --summary "<headline>" --scope "<in scope>" --deliverable "<what shipped>" --files "<changed files>" --confidence "<high|medium|low>" --risks "<risks or none>" --next "<next handoff or none>"`
19. When review materially checks the bug fix, write a review artifact immediately before you move on:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-review-result --repo "$PWD" --title "<short title>" --decision <PASS|FAIL> --summary "<verdict>" --evidence "<files checked>" --files "<files in diff>" --test-summary "<test coverage>" --risks "<risks or none>" --next "<follow-up or none>"`
20. If the bug path or changed behavior can be exercised meaningfully, run validation after review. When validation is expected, record that gate in workflow state:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge validation_expected`
21. When the scenario is substantial enough to preserve, write a validation plan:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-validation-plan --repo "$PWD" --title "<short title>" ...`
22. If you skip validation, say so explicitly and record it in workflow state with a reason:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge validation_skipped --note "<reason>"`
23. When a validator materially checks behavior, write a validation artifact immediately before you move on:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-validation-result --repo "$PWD" --title "<short title>" ...`
24. End with:
   - likely root cause
   - evidence
   - fix status
   - what was reviewed
   - what was validated
   - residual risk
    Use this pre-done checkpoint before you call the fix complete:
    - did code change?
    - if yes, is review resolved or explicitly skipped?
    - if no, did a substantial non-code deliverable still get an appropriate review or explicit skip?
    - did the bug path or changed behavior get exercised?
    - if yes, is validation resolved or explicitly skipped?
    - did the run leave the artifact trail it should?
25. For substantial work, write a final synthesis artifact:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-final-synthesis --repo "$PWD" --title "<short title>" --summary "<summary>" --external-deltas "<off-repo changes required, or 'none'>"`
   - The CLI rejects missing `--external-deltas`. Enumerate sibling-config changes the fix depends on (env var renames in deploy manifests, terraform/helm updates, sibling-repo PRs, feature flags, DB migrations, IAM). Pass `--external-deltas none` explicitly if there are none. A silent default is how renamed env vars silently fall back to old defaults in prod.
