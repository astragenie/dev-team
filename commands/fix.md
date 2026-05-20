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
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" wake-up --repo "$PWD"`
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
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" write-run-brief --repo "$PWD" --title "<short title>" --goal "<goal>" --mode "<mode>"`
8. If using `single-session`, do the investigation directly and do not spawn helpers.
9. Use `assisted single-session` when a bounded helper can compare code paths, gather evidence, or validate a likely fix without becoming a communicating team.
10. Use a `team run` only when multiple independent hypotheses or surfaces can be investigated in parallel.
11. Typical `team run` split:
   - researcher traces code paths and prior behavior
   - builder attempts the smallest credible fix once the problem is clear
   - reviewer checks the code change for regression risk and test coverage
   - validator exercises the bug path and expected behavior when it can be run
12. Use claims only when multiple people may touch overlapping files, and use approvals only for destructive or scope-expanding decisions.
13. Require every teammate or helper to report scope, deliverable, evidence, risks, confidence, and next handoff.
14. If the work produces a code fix, make that code-bearing change independently reviewable. Review should happen before the fix is treated as complete.
15. Substantial non-code deliverables should normally be reviewed before being treated as done.
16. For code fixes, independent review is the default. When code work is complete and waiting for review, record that gate in workflow state:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" mark-badge --repo "$PWD" --badge review_required`
17. If you skip review, say so explicitly and record it in workflow state with a reason:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" mark-badge --repo "$PWD" --badge review_skipped --note "<reason>"`
18. When a helper or teammate returns meaningful evidence or ownership changes, write a handoff artifact if the run is substantial:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" write-handoff --repo "$PWD" --title "<short title>" ...`
19. When review materially checks the bug fix, write a review artifact immediately before you move on:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" write-review-result --repo "$PWD" --title "<short title>" ...`
20. If the bug path or changed behavior can be exercised meaningfully, run validation after review. When validation is expected, record that gate in workflow state:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" mark-badge --repo "$PWD" --badge validation_expected`
21. When the scenario is substantial enough to preserve, write a validation plan:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" write-validation-plan --repo "$PWD" --title "<short title>" ...`
22. If you skip validation, say so explicitly and record it in workflow state with a reason:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" mark-badge --repo "$PWD" --badge validation_skipped --note "<reason>"`
23. When a validator materially checks behavior, write a validation artifact immediately before you move on:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" write-validation-result --repo "$PWD" --title "<short title>" ...`
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
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" write-final-synthesis --repo "$PWD" --title "<short title>" --summary "<summary>"`
