---
description: Preferred short entry point for building or extending capability in the current repo.
---

# Build — Dispatcher Workflow

You are the dispatcher for `/crew:build`. Detect light-path eligibility first; otherwise route via FEAT tag to the standard ladder.

## Light-path detection (run BEFORE FEAT-tag routing)

Match ALL of the following for the light path:

1. **Size**: `git diff --stat HEAD` → ≤2 files changed AND ≤50 lines added/removed
2. **No semantic markers** in the diff additions:
   ```bash
   git diff HEAD | grep -E '^\+' | grep -vE '^\+\+\+' | \
     grep -qE '\b(async|await|Task|throw|try|catch|use[A-Z][a-z]+|IQueryable|Include|\?\.|\?\?)\b'
   # exit 1 (no match) = light path eligible
   ```
3. **No release-sensitive files**: diff does NOT touch `package.json` / `plugin.json` / `marketplace.json` / `hooks/**` / `.claude-plugin/**`
4. User did NOT pass `--full` flag

If matched → light path:

```
crew:dev-lite (mechanical 1-2 file edit, compressed diff receipt)
  ↓
crew:inspector-lite (single review pass, auto-loads stack skill from diff extensions)
  ↓ PASS (decision: approved or approved_with_notes)
mark-badge build_complete
mark-badge inspected
```

If `inspector-lite` returns `rejected` with reason `semantic complexity detected` → fall through to the standard ladder below (re-dispatch via FEAT tag).

If not matched → standard ladder below.

## Standard ladder (FEAT-tag routing)

Routing table (inline):

| FEAT tag                                            | Specialist          |
|-----------------------------------------------------|---------------------|
| stack:typescript + surface:ui                       | crew:frontend-dev   |
| stack:typescript + surface:backend                  | crew:backend-dev    |
| stack:typescript + surface:cross-layer              | crew:fullstack-dev  |
| stack:typescript + surface:plugin                   | crew:aiplugin-dev   |
| stack:csharp                                        | crew:backend-dev    |
| no clear tag                                        | crew:fullstack-dev  |

After the builder returns PASS — parallel inspector fan-out:

Dispatch Inspector A and Inspector B in a **single Agent-tool message** (two parallel invocations):

**Inspector A — stack-specific reviewer:**
- diff contains `.cs` files → `crew:c-sharp-reviewer`
- diff contains `.ts` files (no `.cs`) → `crew:3rdparty:typescript-reviewer`
- no stack reviewer matches → **SKIP A** (no dispatch); promote B to `code-quality` lens

**Inspector B — generalist + lens:**
Always dispatched as `crew:inspector` with lens derived from FEAT concern tag:
- `concern:security` → `security` lens
- `concern:perf` → `performance` lens
- no concern tag or `concern:correctness` → `correctness` lens (default)
- when A is skipped → `code-quality` lens

After both (or only B when A skipped) return their review-result artifacts:
- Any `rejected` decision → stop; escalate to user with the artifact path(s) and findings
- Both `approved` or `approved_with_notes` (or only B approved when A skipped):
  ```
  node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge build_complete
  node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge inspected
  ```
- When A was skipped, `build_complete` requires only Inspector B to approve.

Run `/crew:ship` gates only on explicit user approval.

For what counts as "substantial" below, see the canonical definition in `constitution.md` (`What "Substantial" Means`).

Workflow:

1. First verify the current workspace path:
   - `pwd`
2. Start by reading the repo wake-up brief:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" wake-up --repo "$PWD"`
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
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-run-brief --repo "$PWD" --title "<short title>" --goal "<goal>" --mode "<mode>"`
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
   - Set a `size` on each dispatched task: use `size: light` for trivial tasks (one-line fixes, typo corrections, variable renames) — a light-close skips the `write-handoff` artifact but the teammate still returns the structured completion message. Use `size: standard` (default) for anything substantive — these REQUIRE a `write-handoff` artifact. Light is for noise reduction on trivial work; do not use it to skip audit trail on substantive changes.
14. Require structured acknowledgements and completion reports from every teammate or helper.
   After a subagent completes, read its full report from the artifact path it returned (via `Read` on the handoff path). Do NOT treat the inline return as the full report — agents return only path + headline by contract.
14a. If this run was driven by a design doc (from `/crew:design` or referenced by the user), pass the design doc path to both the builder and the reviewer in their handoffs so they work from the same spec — the explicit path is how specialists link work to a design. If no design doc applies, say "no design doc" explicitly so specialists know no conformance check applies.
15. If the implementation is split into code-bearing sub-tasks, make those sub-tasks independently reviewable and review them where practical before treating them as complete.
16. Substantial non-code deliverables should normally be reviewed before being treated as done.
17. For implementation work that changes code, independent review is the default. When code work is complete and waiting for review, record that gate in workflow state:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge review_required`
18. If you skip review, say so explicitly and record it in workflow state with a reason:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge review_skipped --note "<reason>"`
19. When a helper or teammate hands work back, write a handoff artifact if the run is substantial:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-handoff --repo "$PWD" --title "<short title>" --from <role> --to dispatcher --summary "<headline>" --scope "<in scope>" --deliverable "<what shipped>" --files "<changed files>" --confidence "<high|medium|low>" --risks "<risks or none>" --next "<next handoff or none>"`
20. When a reviewer materially reviews the change, write a review artifact immediately before you move on:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-review-result --repo "$PWD" --title "<short title>" --decision <PASS|FAIL> --summary "<verdict>" --evidence "<files checked>" --files "<files in diff>" --test-summary "<test coverage>" --risks "<risks or none>" --next "<follow-up or none>"`
21. If the changed behavior can be exercised meaningfully, define the validation scenario and run validation after review. When validation is expected, record that gate in workflow state:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge validation_expected`
22. When the scenario is substantial enough to preserve, write a validation plan:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-validation-plan --repo "$PWD" --title "<short title>" ...`
23. If you skip validation, say so explicitly and record it in workflow state with a reason:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge validation_skipped --note "<reason>"`
24. When a validator materially checks behavior, write a validation artifact immediately before you move on:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-validation-result --repo "$PWD" --title "<short title>" ...`
24a. **Auto-continue to dev ship (opt-in).** After review and validation are both resolved, check `.claude/crew/deployment.md` for a `dev.stable: true` setting. If present AND all build gates are green (review PASS or `review_skipped` with reason, validation PASS or `validation_skipped` with reason, no open `help_request`) AND the target environment is dev (not production), continue into the `/crew:ship` flow in this same session — do not return to the user at the review boundary. Production promotion still requires explicit user approval per `agents/deployer.md` rule 11. If `dev.stable: true` is absent or any gate is not green, stop at synthesis (step 25) as today and surface the unresolved gate.
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
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-final-synthesis --repo "$PWD" --title "<short title>" --summary "<summary>" --external-deltas "<off-repo changes required, or 'none'>"`
   - The CLI rejects missing `--external-deltas`. Enumerate sibling-config changes the synthesis depends on (env var renames in deploy manifests, terraform/helm updates, sibling-repo PRs, feature flags, DB migrations, IAM). Pass `--external-deltas none` explicitly if there are none. A silent default is how renamed env vars silently fall back to old defaults in prod.
