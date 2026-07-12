---
findings: "[LOW] gh pr diff 224 / gh pr view 224 returned a STALE head — process risk, not a code defect\nRisk: gh api repos/astragenie/dev-team/pulls/224 reports head.sha=150718f6 and a 2-commit list ([0b484ee2, 150718f6]), which is missing the branch's actual latest commit. Direct query of the git ref (gh api repos/astragenie/dev-team/git/refs/heads/docs/dispatch-isolation-169) and a local git fetch both show the branch tip is actually 0026c8f6 \"fix(dispatch): correct isolation: mechanism per review (PR #224 needs_fix)\", authored 2026-07-12T16:15:45-05:00 (~21:15:45Z), pushed moments before this review ran. `gh pr diff 224` (cached PR head) still shows the OLD broken text (\"isolation: worktree pointed at ... the worktree path\") that was the subject of the prior review's blocking finding. Anyone reviewing via `gh pr diff`/the GitHub PR \"Files changed\" tab right now risks seeing/acting on stale content; a merge via `gh pr merge` operates on the actual branch ref so it should pick up 0026c8f6, but a human eyeballing the GitHub UI diff at this moment would see the unfixed version.\nFix: no code fix needed. Before merging, refresh the PR view (reload the GitHub PR page, or re-run `gh pr view --json headRefOid` and compare to `git rev-parse origin/docs/dispatch-isolation-169`) to confirm GitHub's cached PR record has caught up to 0026c8f6 before a human signs off on the visual diff.\n\n[MEDIUM] commands/parallel.md — \"Attaching to a pre-created worktree (dev-team#169)\" section overstates what is harness-enforced\nRisk: The section states \"Before anything else, call EnterWorktree... Do this as your first tool call\" and then says \"This is harness-enforced by the EnterWorktree tool call itself... not by the surrounding prose.\" Verified against the live EnterWorktree schema: calling the tool DOES harness-enforce the resulting cwd switch, but nothing enforces that the subagent's actual first tool call IS EnterWorktree — a non-compliant or distracted crew:build subagent could Read/Edit/Bash before ever calling EnterWorktree, silently writing in the wrong tree (the dispatcher's own cwd), reproducing a variant of the original #169 bug. This exact residual risk is already acknowledged in the design doc (.claude/artifacts/crew/designs/2026-07-12-subagent-lifecycle-guards.md §6 item 4, \"Reopen trigger (recorded)\") as an accepted tradeoff — a hard PreToolUse cwd-assertion hook was explicitly rejected as infeasible. parallel.md's phrasing doesn't carry the same explicit \"this is convention, not enforcement\" caveat the design doc uses, so a future reader of parallel.md alone (without cross-referencing the design doc) could believe the ordering itself is guaranteed.\nFix: add one sentence to parallel.md's new section making explicit that the ORDERING (EnterWorktree-first) is prompt-level convention, not hook-enforced, matching the design doc's own framing — e.g. \"Nothing prevents a non-compliant subagent from calling another tool first; this ordering is enforced by dispatch-prompt discipline, not by the harness.\" Non-blocking: the underlying design already accepts this risk with a recorded reopen trigger."
status: completed
decision: approved_with_notes
author_id: claude
judge_id: crew:reviewer
self_approval: false
---
# Review Result: Review Result

- Created: 2026-07-12T21:30:19.107Z
- Reviewer: reviewer
- Decision: approved_with_notes
- Status: completed
- Summary: Re-review of dev-team PR #224 (docs/dispatch-isolation-169), evaluated at the ACTUAL current branch tip `0026c8f6` (a follow-up commit not yet reflected in `gh pr diff`/`gh pr view` cached PR metadata — see risk note). The follow-up commit fully corrects the second fiction: parallel.md no longer tells dispatchers to set `isolation: "worktree"` "pointed at" a path (impossible — confirmed against the live `Agent` tool schema, isolation is a bare `"worktree"|"remote"` enum with no path field). Instead it dispatches with no `isolation:` field and has the subagent call `EnterWorktree({path:...})` on itself as its first tool call. This was verified against the live `EnterWorktree` tool schema, not taken on the builder's word.
- Evidence Checked:
  - Loaded live EnterWorktree schema via ToolSearch (select:EnterWorktree); confirmed subagent-self-invoked
  - path form attaches to existing tree
  - no .claude/worktrees restriction on first entry from launch dir for an unpinned session. Confirmed gh pr diff 224 / gh pr view 224 return a STALE cached head (150718f6) vs actual branch tip 0026c8f6 (verified via git/refs/heads API + local fetch + git rev-parse). Reviewed 0026c8f6 diff directly (git diff 150718f6 0026c8f6 and git diff origin/main...0026c8f6 --stat).
- Files Reviewed:
  - commands/build.md
  - commands/fix.md
  - commands/parallel.md
  - .claude/artifacts/crew/designs/2026-07-12-subagent-lifecycle-guards.md
- Test Adequacy: -
- Non-Code Review: yes
- Author: claude
- Judge: crew:reviewer
- Risks: GitHub PR metadata (head SHA / diff view) lags the actual pushed branch tip by one commit as of this review; a human eyeballing gh pr diff or the GitHub UI right now would see the old broken text even though the real branch content is fixed. EnterWorktree-first ordering in the peer-dispatch flow is prompt convention, not hook-enforced (accepted residual risk, already recorded in the design doc's reopen trigger).
- Required Follow-up: Before merge: confirm GitHub's PR record has synced to 0026c8f6 (gh pr view --json headRefOid should equal git rev-parse origin/docs/dispatch-isolation-169). Optionally add one clarifying sentence to parallel.md's new section stating the EnterWorktree-first ordering is convention-enforced, not harness-enforced.

