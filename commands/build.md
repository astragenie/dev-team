---
description: Preferred short entry point for building or extending capability in the current repo.
---

# Build With The Lead Workflow

Act as the lead for a bounded feature delivery run.

For what counts as "substantial" below, see the canonical definition in `constitution.md` (`What "Substantial" Means`).

Workflow:

1. First verify the current workspace path:
   - `pwd`
2. Start by reading the repo wake-up brief:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" wake-up --repo "$PWD"`
3. Explicitly confirm the returned `repoPath` matches the current working directory. If it does not, stop and correct the repo context before proceeding.
   For substantial work, do not start implementation until this step is complete.
   In an established same-repo session, do this quietly unless there is an actual mismatch or repo switch.
4. Follow this phase order:
   - frame
   - implement
   - review if code changed
   - validate if behavior can be exercised meaningfully
   - synthesize
5. Restate the feature goal and frame the task:
   - what the user wants
   - what is in scope
   - what is out of scope
   - what repo or external context matters
   - whether the work should stay whole or be split into bounded sub-tasks
   If this is a continuation of the same workstream, do not re-state the whole framing block unless scope materially changed.
6. Choose one of:
   - `single-session`
   - `assisted single-session`
   - `team run`
7. If the task is substantial enough that future wake-up context will matter, immediately write a run brief with:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" write-run-brief --repo "$PWD" --title "<short title>" --goal "<goal>" --mode "<mode>"`
8. If using `single-session`, do the work directly and do not spawn helpers.
9. Use `assisted single-session` when a helper can reduce uncertainty or validate work without becoming a communicating team.
10. Only use a `team run` when ownership can be split cleanly.
11. If using a `team run`, claim files only when parallel work might collide, and open approvals only when scope or ownership boundaries must be crossed.
12. If using a `team run`, assign bounded work to:
   - builder for implementation
   - reviewer for change review
   - validator for behavior checks when behavior can be exercised
   - researcher for uncertainty reduction if needed
13. Keep ownership explicit and avoid same-file parallel editing.
14. Require structured acknowledgements and completion reports from every teammate or helper.
   After a subagent completes, read its full report from the artifact path it returned (via `Read` on the handoff path). Do NOT treat the inline return as the full report — agents return only path + headline by contract.
15. If the implementation is split into code-bearing sub-tasks, make those sub-tasks independently reviewable and review them where practical before treating them as complete.
16. Substantial non-code deliverables should normally be reviewed before being treated as done.
17. For implementation work that changes code, independent review is the default. When code work is complete and waiting for review, record that gate in workflow state:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" mark-badge --repo "$PWD" --badge review_required`
18. If you skip review, say so explicitly and record it in workflow state with a reason:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" mark-badge --repo "$PWD" --badge review_skipped --note "<reason>"`
19. When a helper or teammate hands work back, write a handoff artifact if the run is substantial:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" write-handoff --repo "$PWD" --title "<short title>" --from <role> --to lead --summary "<headline>" --scope "<in scope>" --deliverable "<what shipped>" --files "<changed files>" --confidence "<high|medium|low>" --risks "<risks or none>" --next "<next handoff or none>"`
20. When a reviewer materially reviews the change, write a review artifact immediately before you move on:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" write-review-result --repo "$PWD" --title "<short title>" --decision <PASS|FAIL> --summary "<verdict>" --evidence "<files checked>" --files "<files in diff>" --test-summary "<test coverage>" --risks "<risks or none>" --next "<follow-up or none>"`
21. If the changed behavior can be exercised meaningfully, define the validation scenario and run validation after review. When validation is expected, record that gate in workflow state:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" mark-badge --repo "$PWD" --badge validation_expected`
22. When the scenario is substantial enough to preserve, write a validation plan:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" write-validation-plan --repo "$PWD" --title "<short title>" ...`
23. If you skip validation, say so explicitly and record it in workflow state with a reason:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" mark-badge --repo "$PWD" --badge validation_skipped --note "<reason>"`
24. When a validator materially checks behavior, write a validation artifact immediately before you move on:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" write-validation-result --repo "$PWD" --title "<short title>" ...`
25. End with a clear synthesis for the user:
   - what changed
   - what was reviewed
   - what was validated
   - risks or open questions
   - what happens next
    Use this pre-done checkpoint before you call the work complete:
    - did code change?
    - if yes, is review resolved or explicitly skipped?
    - if no, did a substantial non-code deliverable still get an appropriate review or explicit skip?
    - did behavior change?
    - if yes, is validation resolved or explicitly skipped?
    - did the run leave the artifact trail it should?
26. For substantial work, write a final synthesis artifact:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.mjs" write-final-synthesis --repo "$PWD" --title "<short title>" --summary "<summary>"`
