---
description: Preferred short entry point for investigating and fixing broken behavior in the current repo.
---

# Fix — Dispatcher Workflow

You are the dispatcher for `/crew:fix`. Detect light-path eligibility first; otherwise route via investigator → builder → parallel reviewers.

For what counts as "substantial" below, see the canonical definition in `constitution.md` (`What "Substantial" Means`).

## Light-path detection (run BEFORE investigator dispatch)

Match ALL of the following for the light path:

1. **Size**: `git diff --stat HEAD` → ≤2 files changed AND ≤50 lines added/removed
2. **No semantic markers** in the diff additions (escalates to standard ladder if matched):
   ```bash
   git diff HEAD | grep -E '^\+' | grep -vE '^\+\+\+' | \
     grep -qE '\b(async|await|Task|Promise|IQueryable|Include|use[A-Z][a-z]+)\b|\btry\s*\{|\bcatch\s*\('
   # exit 1 (no match) = light path eligible
   ```
3. **No release-sensitive files**: diff does NOT touch `package.json` / `plugin.json` / `marketplace.json` / `hooks/**` / `.claude-plugin/**`
4. **Root cause is obvious from the diff** (typo / off-by-one / null check / wrong constant) — no upstream investigation needed
5. User did NOT pass `--full` flag

If matched → light path (no investigator, no parallel A+B fan-out):

```
crew:dev-lite (mechanical 1-2 file fix, compressed diff receipt)
  ↓
crew:reviewer-lite (single review pass, auto-loads stack skill from diff extensions)
  ↓ PASS (decision: approved or approved_with_notes)
mark-badge review_passed
mark-badge inspected
```

If `reviewer-lite` returns `rejected` (semantic complexity detected, MEDIUM+ finding requiring code change) → fall through to the standard ladder below (re-dispatch via investigator + FEAT tag).

If not matched → standard ladder below.

## Collision pre-flight (WS-4 — run BEFORE write-run-brief / builder dispatch)

Git-native, no lock file: before this dispatcher writes its own run brief (Workflow step 6 below) or dispatches investigator/builder, check whether another build/fix is already in progress on the branch currently checked out here. Run this check FIRST — `write-run-brief` archives the existing `currentRun` into `recentRuns` and starts a fresh one, which erases the very signal this check depends on, so the ordering matters.

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
  3. Re-verify the workspace: `pwd` inside the new worktree, then re-run Workflow step 2 below (`crew.ts wake-up --repo "<new-worktree-path>"`) so the rest of this run's `--repo` / `$PWD` references point at the isolated worktree, not the original directory.
  4. Continue the rest of this workflow (investigator/researcher triage, `write-run-brief`, builder dispatch, review, etc.) entirely inside the isolated worktree. Do not flip any global `worktreeMode`-style default for the repo — this isolation applies to this run only.

## Phase order (standard ladder)

### Triage step — pick the right investigation tool

Before dispatching anything, triage the bug report:

| Bug report state | Right dispatch |
|---|---|
| "Where is X called?" / "List every caller of Y" / "Map this module" — **location only, no causation reasoning** | `crew:investigator` (haiku, cheap, no handoff artifact, dies with turn) |
| "Why does this fail?" / "What's the root cause?" / multi-file causal reasoning / need confidence + evidence trail + reproduction path in a persistent artifact | `crew:researcher` (sonnet, scopes: normal/wide, writes findings with confidence + risks) |
| Root cause already obvious from bug report (typo, off-by-one, known regression in commit X) | **Skip both — go directly to builder** |
| Cause known, multi-site fix scope unknown | `crew:investigator` to enumerate sites, then builder |

**Common mistake:** dispatching `crew:investigator` for root cause analysis. Investigator's own prompt says: *"Refuses to suggest fixes; escalate to crew:researcher when findings must persist with confidence + risks."* The haiku model + `maxTurns: 12` + no-handoff design cannot deliver root-cause artifacts with confidence + evidence — it will die at the cap. Use researcher.

```
workspace verify + wake-up brief
   ↓
TRIAGE (table above) → investigator | researcher | skip
   ↓ optional finding artifact (researcher only — investigator output dies with turn)
specialist builder (FEAT tag → builder, same routing as /crew:build)
   ↓ PASS (builder writes handoff)
parallel fan-out — single Agent-tool message with N=2 invocations:
   Reviewer A (stack-specific)     Reviewer B (generalist + lens)
      diff has .cs → crew:csharp-reviewer   crew:reviewer with lens chosen by FEAT concern:*
      diff has .ts → crew:typescript-reviewer   concern:security → security
      no stack match → SKIP A, B uses code-quality lens   concern:perf → performance
   ↓                                         concern:correctness (default)
   └──────────────────┬───────────────────────┘
                      ↓ aggregate both decisions
   any rejected? ─── yes ─→ retry loop below
   both approved / approved_with_notes:
     mark-badge review_passed
     if Reviewer B next field names a tests-adequacy gap → dispatch crew:qa-expert
```

No verifier dispatch. Verifier defers to `/crew:ship`.

## Auto-fix retry loop (when Reviewer rejects)

Symmetric with `/crew:ship`'s auto-fix loop. When either Reviewer A or Reviewer B returns `rejected`:

1. Read both review-result artifacts for the aggregated FAIL findings.
2. Re-dispatch the same specialist builder with the findings as fix scope.
3. Increment retry counter.
4. Re-run the parallel reviewer fan-out.
5. Retry < N (default 2 from `.claude/crew/deployment.md` `fix.retry_limit`)? Loop. Else halt.

On N exhausted:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge blocked \
  --note "<aggregated FAIL summary>"
```

Escalate to user with both artifact paths + findings. Do not silently keep trying.

## Builder routing table

See `docs/routing-table.md` → "Builder routing matrix" (generated from `docs/routing-table.yaml` — the authoritative source; do not hand-copy the table here, edit the yaml and re-run `node scripts/render-routing-table.ts` instead). `commands/orchestrate-slice.md` "Builder routing" carries the full signal-level decision detail (`FE_ONLY`/`BE_ONLY`/`SPLIT_BUILD`/`TS_TOOLING_ONLY`) this matrix summarizes.

## Model tier resolution (REQUIRED — run before every builder Agent-tool dispatch)

**Do NOT inherit the session model for the builder dispatch.** Before invoking the `Agent` tool in step 7 below, resolve the builder's tier explicitly:

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" resolve-model --repo "$PWD" --phase build
```

Pass the printed value (e.g. `sonnet`) as the Agent-tool dispatch's `model:` argument. Add `--shape <shape>` when the fix classifies as a trivial shape (`doc-update` / `config-tweak` / `test-only` / `single-module-edit`) — it overrides the phase tier.

**Honest limitation:** no hard hook enforces this — unlike the autonomous wave path (`runner-plugin`'s `model-router`), which sets the dispatch model programmatically, this instruction only works if the dispatcher LLM actually runs `resolve-model` and actually passes its output as `model:`. A `PreToolUse` hook on `Agent` that injects the resolved model when absent (S2b) would close the gap — not built here.

## Workflow

1. Verify the current workspace path:
   - `pwd`
2. Read the repo wake-up brief:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" wake-up --repo "$PWD"`
3. Confirm the returned `repoPath` matches `$PWD`. If not, stop and correct repo context before proceeding.
   For substantial work, do not start implementation until this step is complete.
4. Dispatch `crew:investigator` (read-only, no file changes):
   - Pass the bug description and any known repro path.
   - Read the returned finding artifact in full before proceeding.
5. Restate the root cause and frame the fix:
   - confirmed root cause (from investigator finding)
   - expected behavior
   - fix scope (in scope / out of scope)
   - whether the work should stay whole or be split into bounded sub-tasks
6. If the task is substantial enough that future wake-up context will matter, write a run brief:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-run-brief --repo "$PWD" --title "<short title>" --goal "<goal>" --mode "team run"`
7. Pick the specialist builder from the routing table above and dispatch via the `Agent` tool.
   - **Resolve the model tier first** via "Model tier resolution" above (`crew resolve-model --phase build`) and pass the printed value as the Agent-tool `model:` argument — do NOT inherit the session model.
   - **Recall injection (FEAT-188 S3a):** before dispatching, fetch a recall block:
     `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" recall-block --repo "$PWD" --agent <specialist-agent-name> --tags "<FEAT tags csv>"`
     If `.block` is non-empty, prepend it verbatim (it is already the `## Prior context (from astramem)` block) to the builder's dispatch instruction. If empty (memory not configured, or nothing recalled), omit — do not add any placeholder text.
   - Set `size: standard` for substantive changes (requires `write-handoff` artifact).
   - Set `size: light` only for trivial one-line fixups (skips artifact, but builder still returns structured completion).
   - If this run references a design doc, pass the design doc path to the builder.
8. After the builder returns PASS, write a handoff artifact if the run is substantial:
   - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-handoff --repo "$PWD" --title "<short title>" --from builder --to dispatcher --summary "<headline>" --scope "<in scope>" --deliverable "<what shipped>" --files "<changed files>" --confidence "<high|medium|low>" --risks "<risks or none>" --next "reviewer fan-out"`
9. Fan out two reviewers in a **single Agent-tool message** (parallel dispatch):
   - **Reviewer A** — stack-specific reviewer (see phase order diagram above for routing; skip A if no stack match).
   - **Reviewer B** — `crew:reviewer` with lens from FEAT concern tag (default: `correctness`).
   - Pass the builder handoff artifact path to both reviewers.
9a. **Reviewer fan-out watchdog (dev-team#199).** If one reviewer of the parallel fan-out is idle with no artifact after the other reviewer has already returned, send one `SendMessage` status-check nudge to the idle reviewer. If it is still silent after that single nudge, mark `blocked` (`mark-badge --badge blocked --note "reviewer <name> idle with no artifact after nudge"`) and proceed under the single-reviewer policy (step 12) rather than waiting indefinitely. **Idle-ping guidance:** an `idle_notification` ping from a reviewer that already delivered its artifact is noise, not a signal to act on — do not re-dispatch or nudge on it.
10. After both reviewer artifacts land, write a review result for each:
    - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-review-result --repo "$PWD" --title "<short title>" --decision <approved|approved_with_notes|rejected> --author-id <builder-agent> --judge-id <reviewer-agent> --summary "<verdict>" --evidence "<files checked>" --files "<files in diff>" --test-summary "<test coverage>" --risks "<risks or none>" --next "<follow-up or none>"`
11. If either reviewer returns `rejected`, stop. Surface the findings to the user. Do not emit `review_passed`.
12. If Reviewer A is skipped, `review_passed` requires only Reviewer B to approve.
13. If both approved (or `approved_with_notes`), emit the completion badge:
    - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" mark-badge --repo "$PWD" --badge review_passed`
14. Check Reviewer B's `next` field. If it names a tests-adequacy gap, dispatch `crew:qa-expert`:
    - Pass the finding artifact and the changed files list.
    - Wait for `crew:qa-expert` to return before closing the run.
15. End with a clear synthesis for the user:
    - confirmed root cause
    - what changed
    - what was reviewed (Reviewer A / B decisions)
    - residual risk
    - what happens next (e.g. `/crew:ship` when ready)
    Use this pre-done checkpoint before you call the fix complete:
    - did code change?
    - if yes, did both reviewers resolve (or A skipped + B approved)?
    - did the run leave the artifact trail it should?
16. For substantial work, write a final synthesis artifact:
    - `node "${CLAUDE_PLUGIN_ROOT}/scripts/crew.ts" write-final-synthesis --repo "$PWD" --title "<short title>" --summary "<summary>" --external-deltas "<off-repo changes required, or 'none'>"`
    - The CLI rejects missing `--external-deltas`. Enumerate sibling-config changes the fix depends on. Pass `--external-deltas none` explicitly if there are none.
