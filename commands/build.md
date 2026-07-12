---
description: Preferred short entry point for building or extending capability in the current repo.
---

# Build — Dispatcher Workflow

You are the dispatcher for `/crew:build`. Detect light-path eligibility first; otherwise route via FEAT tag to the standard ladder.

## Light-path detection (run BEFORE FEAT-tag routing)

Match ALL of the following for the light path:

1. **Size**: `git diff --stat HEAD` → ≤2 files changed AND ≤50 lines added/removed
2. **No semantic markers** in the diff additions (escalates to standard ladder if matched):
   ```bash
   git diff HEAD | grep -E '^\+' | grep -vE '^\+\+\+' | \
     grep -qE '\b(async|await|Task|Promise|IQueryable|Include|use[A-Z][a-z]+)\b|\btry\s*\{|\bcatch\s*\('
   # exit 1 (no match) = light path eligible
   # Note: null-safety reads (?., ??) and replacement throws are allowed in light
   # path — dev-lite agent will catch the genuinely new exception-flow cases.
   ```
3. **No release-sensitive files**: diff does NOT touch `package.json` / `plugin.json` / `marketplace.json` / `hooks/**` / `.claude-plugin/**`
4. User did NOT pass `--full` flag

If matched → light path:

```
crew:dev-lite (mechanical 1-2 file edit, compressed diff receipt)
  ↓
crew:reviewer-lite (single review pass, auto-loads stack skill from diff extensions)
  ↓ PASS (decision: approved or approved_with_notes)
mark-badge review_passed
```

If `reviewer-lite` returns `rejected` with reason `semantic complexity detected` → fall through to the standard ladder below (re-dispatch via FEAT tag).

If not matched → standard ladder below.

## Collision pre-flight (WS-4 — run BEFORE write-run-brief / builder dispatch)

Git-native, no lock file: before this dispatcher writes its own run brief (step 7 below) or dispatches a builder, check whether another build/fix is already in progress on the branch currently checked out here. Run this check FIRST — `write-run-brief` archives the existing `currentRun` into `recentRuns` and starts a fresh one, which erases the very signal this check depends on, so the ordering matters.

```bash
current_branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
collision_worktree=""
if [ -n "$current_branch" ]; then
  while IFS= read -r wt_path; do
    [ -z "$wt_path" ] && continue
    state_file="$wt_path/.claude/state/crew/workflow-state.json"
    [ -f "$state_file" ] || continue
    status=$(jq -r '.currentRun.status // empty' "$state_file" 2>/dev/null)
    if [ -n "$status" ] && [ "$status" != "completed" ]; then
      collision_worktree="$wt_path"
      break
    fi
  done < <(git worktree list --porcelain | awk -v b="refs/heads/$current_branch" \
      '/^worktree /{wt=$2} /^branch /{if ($2==b) print wt}')
fi
```

- Each worktree owns its own `.claude/state/crew/workflow-state.json` — there is no shared lock, so detection means reading a candidate worktree's own state file directly. This also covers the common case where the CURRENT directory is the only worktree entry on this branch and it already has an unfinished `currentRun` (status not `completed`) from an earlier, not-yet-closed build/fix.
- Fail-open: if `git`, `jq`, or the state file read fails for any reason, treat it as "no collision" and proceed normally — this is a collision *trigger*, not a hard gate.
- If `collision_worktree` is empty → no collision, proceed with the workflow below unchanged.
- If `collision_worktree` is non-empty → isolate THIS session into its own worktree before continuing:
  1. Pick (or reuse) a worktree path: `<parent-of-repo>/<repo-basename>-worktrees/<branch-name>` (same sibling convention the loop plugin's `worktree-manager` uses — keeps the two ceremonies consistent when both are installed in a repo).
  2. If that path is not already a registered worktree, create it: `git worktree add "<path>" -b "<branch-name>-<short-suffix>"` (or reuse the existing worktree/branch if `git worktree list` already shows it).
  3. Re-verify the workspace: `pwd` inside the new worktree, then re-run step 2 of the Workflow below (`crew.ts wake-up --repo "<new-worktree-path>"`) so the rest of this run's `--repo` / `$PWD` references point at the isolated worktree, not the original directory.
  4. Continue the rest of this workflow (framing, `write-run-brief`, builder dispatch, review, etc.) entirely inside the isolated worktree. Do not flip any global `worktreeMode`-style default for the repo — this isolation applies to this run only.

### Peer-dispatch isolation (distinct from the self-isolation above — dev-team#169)

The collision pre-flight above is this dispatcher session isolating **itself** into a worktree on branch collision. That is a different problem from this dispatcher **peer-dispatching a builder** into a separate tree — e.g. a background/parallel builder dispatch during a `team run` whose work should land in a worktree distinct from this dispatcher's own cwd.

When this ladder dispatches such a peer, the `Agent`-tool call MUST carry `isolation: "worktree"` — never a prompt-text instruction like "operate in `<path>`" alone. Prompt text cannot pin a subagent's cwd; only the harness's own `isolation:` parameter can. Note `isolation: "worktree"` is a bare enum: it takes no path argument and always creates a **fresh** temporary worktree for that dispatch — it cannot attach a subagent to a worktree that already exists. This ladder has no pre-existing worktree to attach to, so that's not a gap here; if a future ladder needs "attach to a specific pre-created tree," see `commands/parallel.md`'s "Attaching to a pre-created worktree" note — the mechanism is different (`EnterWorktree`, called by the dispatched subagent itself, not a dispatcher-side parameter). If the dispatch does not need a separate tree — the common case, most builder dispatches in this ladder run in the dispatcher's own cwd — omit `isolation:` entirely; do not add it defensively where it isn't needed.

## Standard ladder (FEAT-tag routing)

Builder routing: see `docs/routing-table.md` → "Builder routing matrix" (generated from `docs/routing-table.yaml` — the authoritative source; do not hand-copy the table here, edit the yaml and re-run `node scripts/render-routing-table.ts` instead). `commands/orchestrate-slice.md` "Builder routing" carries the full signal-level decision detail (`FE_ONLY`/`BE_ONLY`/`SPLIT_BUILD`/`TS_TOOLING_ONLY`) this matrix summarizes.

### Model tier resolution (REQUIRED — run before every builder Agent-tool dispatch)

**Do NOT inherit the session model for the builder dispatch.** Before invoking the `Agent` tool for the specialist builder, resolve its tier explicitly:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" resolve-model --repo "$PWD" --phase build
```

Pass the printed value (e.g. `sonnet`) as the Agent-tool dispatch's `model:` argument. **If it prints `inherit` (model routing disabled), OMIT the `model:` argument entirely** — the dispatched agent's own `model:` frontmatter (`agents/*.md`) then governs; do not substitute a model yourself. If the slice classifies as a trivial shape (`doc-update` / `config-tweak` / `test-only` / `single-module-edit`), pass `--shape <shape>` too — it overrides the phase tier. This mirrors the autonomous wave path's `resolveWaveDispatchModel`, which sets the model programmatically; here the resolution is honored by the orchestrator LLM, not enforced by a hook — see "Honest limitation" below.

**Honest limitation:** this instruction has no hard hook enforcement. The autonomous wave path (`runner-plugin`'s `model-router`) sets the dispatch model programmatically before the subagent spawns; the interactive path here relies on the dispatcher LLM (you) actually running `resolve-model` and actually passing its output as `model:`. A `PreToolUse` hook on `Agent` that injects the resolved model when `model:` is absent (S2b) would close this gap — not built in this slice.

After the builder returns PASS — parallel reviewer fan-out:

Dispatch Reviewer A and Reviewer B in a **single Agent-tool message** (two parallel invocations):

**Reviewer A — stack-specific reviewer:**
- diff contains `.cs` files → `crew:csharp-reviewer`
- diff contains `.ts` files (no `.cs`) → `crew:typescript-reviewer`
- no stack reviewer matches → **SKIP A** (no dispatch); promote B to `code-quality` lens

**Reviewer B — generalist + lens:**
Always dispatched as `crew:reviewer` with lens derived from FEAT concern tag:
- `concern:security` → `security` lens
- `concern:perf` → `performance` lens
- no concern tag or `concern:correctness` → `correctness` lens (default)
- when A is skipped → `code-quality` lens

After both (or only B when A skipped) return their review-result artifacts:
- Any `rejected` decision → stop; escalate to user with the artifact path(s) and findings
- Both `approved` or `approved_with_notes` (or only B approved when A skipped):
  ```
  node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge review_passed
  ```
- When A was skipped, `review_passed` requires only Reviewer B to approve.

**Reviewer fan-out watchdog (dev-team#199).** If one reviewer of the parallel fan-out is idle with no artifact after the other reviewer has already returned, send one `SendMessage` status-check nudge to the idle reviewer. If it is still silent after that single nudge, mark `blocked` (`mark-badge --badge blocked --note "reviewer <name> idle with no artifact after nudge"`) and proceed under the single-reviewer policy (A skipped / only B required) rather than waiting indefinitely. **Idle-ping guidance:** a `teammate_idle` notification (payload `{"type":"idle_notification"}`) from a reviewer that already delivered its artifact is noise, not a signal to act on — do not re-dispatch or nudge on it.

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
   - builder for implementation — **resolve its model tier first** via "Model tier resolution" above, and pass it explicitly as the Agent-tool `model:` argument. Never let the builder dispatch silently inherit the session model.
   - reviewer for change review
   - validator for behavior checks when behavior can be exercised
   - researcher for uncertainty reduction if needed
12a. **Recall injection (FEAT-188 S3a).** Before dispatching the builder, fetch a recall block:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" recall-block --repo "$PWD" --agent <builder-agent-name> --tags "<FEAT tags csv>"`
   - If `.block` is non-empty, prepend it verbatim (it is already the `## Prior context (from astramem)` block) to the builder's dispatch instruction. If empty (memory not configured, or nothing recalled), omit — do not add any placeholder text.
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
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-review-result --repo "$PWD" --title "<short title>" --decision <approved|approved_with_notes|rejected> --author-id <builder-agent> --judge-id <reviewer-agent> --summary "<verdict>" --evidence "<files checked>" --files "<files in diff>" --test-summary "<test coverage>" --risks "<risks or none>" --next "<follow-up or none>"`
   - If `--summary` (or any prose flag) contains apostrophes/backticks, shell argv quoting can mangle or drop it (dev-team#152). Write the body to a temp file and pass `--summary-file <path>` (or any `--<flag>-file <path>`) instead.
21. If the changed behavior can be exercised meaningfully, define the validation scenario and run validation after review. When validation is expected, record that gate in workflow state:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge validation_expected`
22. When the scenario is substantial enough to preserve, write a validation plan:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-validation-plan --repo "$PWD" --title "<short title>" ...`
23. If you skip validation, say so explicitly and record it in workflow state with a reason:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge validation_skipped --note "<reason>"`
24. When a validator materially checks behavior, write a validation artifact immediately before you move on:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-validation-result --repo "$PWD" --title "<short title>" ...`
24a. **Auto-continue to dev ship (opt-in).** After review and validation are both resolved, check `.claude/crew/deployment.md` for a `dev.stable: true` setting. If present AND all build gates are green (review PASS or `review_skipped` with reason, validation PASS or `validation_skipped` with reason, no open `help_request`) AND the target environment is dev (not production), continue into the `/crew:ship` flow in this same session — do not return to the user at the review boundary. Production promotion still requires explicit user approval per `agents/release-engineer.md` rule 11. If `dev.stable: true` is absent or any gate is not green, stop at synthesis (step 25) as today and surface the unresolved gate.
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
   - For `--summary` prose with apostrophes/backticks, prefer `--summary-file <path>` over inlining it (dev-team#152).
