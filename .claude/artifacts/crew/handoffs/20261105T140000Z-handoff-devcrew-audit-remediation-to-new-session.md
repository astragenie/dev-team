# Task Handoff: execute the devcrew audit remediation plan (new session)

- Created: 2026-11-05T14:00:00Z
- From: dispatcher (dev-team session "dev-team", Fable 5.1)
- To: a fresh Claude Code session working in `astragenie/dev-crew`
- Objective: execute `docs/superpowers/plans/2026-11-05-devcrew-audit-remediation.md` task by task (12 tasks, TDD, red-first) so devcrew runs from a clean consumer install, gates fail closed, references resolve, and smoke tests pass.
- Owner: the new session (dispatcher role); builders per task
- Allowed Scope: `astragenie/dev-crew` on branch `fix/audit-2026-11` in a worktree; local commits per task; read-only access to `C:\work\mega\dev-team` for the spec files.
- Forbidden Scope: any edit to `C:\work\mega\dev-team` (archived); push, tag, release, `marketplace.json`; edits to `main`.
- Deliverable: branch `fix/audit-2026-11` with all 12 task commits, `docs/audits/2026-11-05/smoke-after.md` showing every baseline FAIL row turned PASS, whole-branch review artifact.

## Inputs (all under `C:\work\mega\dev-team`, read-only)

| Purpose | Path |
|---|---|
| The plan (execute this) | `docs/superpowers/plans/2026-11-05-devcrew-audit-remediation.md` |
| Audit synthesis (53 findings, plan rationale) | `.claude/artifacts/crew/reviews/20261105T130000Z-plugin-audit-and-landscape.md` |
| Codex independent review (sequencing + 6 missed P1s) | `.claude/artifacts/crew/reviews/20261105T132500Z-codex-review-of-plugin-audit.md` |
| Smoke baseline (what must turn green) | `.claude/artifacts/crew/validations/20261105T134500Z-validation-devcrew-consumer-smoke-baseline.md` |
| 16 per-agent source reports | `.claude/artifacts/crew/reviews/20261105-audit-sources/` |

## State the new session must know

- dev-team is archived (2026-08-19). The live plugin is devcrew; `astragenie/dev-crew` has **no local checkout** under `C:\work`. Plan Task 0 clones it to `C:\work\mega\dev-crew` and works in `.worktrees/fix-audit-2026-11`.
- The installed cache `~/.claude/plugins/cache/astra/devcrew/1.1.0` is the artifact consumers get; it has no `node_modules`. All line numbers in the plan cite that version. Task 0 Step 2 diffs the clone against it.
- Verified on 2026-11-05 against that cache: 4 of 6 crew hooks crash (incl. gate guard and pre-push gate), `crew.mts brief-me` / `show-workflow-state` crash, `--decision` is optional and defaults to passed, two reviewers are last-writer-wins, CI `.md$` exemption skips agents/commands/skills, `/devcrew:parallel` dispatches a nonexistent agent, `/devcrew:fix` uses an invalid badge, light path fails open on an empty diff.
- Hook `timeout` fields already exist in devcrew (fixed vs dev-team); `onFailure` does not.
- Commands invoke `bun` for `crew/scripts/crew.mts` (85 refs) and `src/scripts/loop.mts` (37 refs); `loop.mts` refuses to run under Node.
- `C:\work\mega\dev-team` git status has pre-existing uncommitted items (`.gitleaks.toml` staged, `scripts/windows/`, July handoff) plus today's artifacts; nothing was committed there and nothing should be.

## How to start the new session

Open Claude Code in `C:\work\mega` (or anywhere), then paste:

```
Read C:\work\mega\dev-team\.claude\artifacts\crew\handoffs\20261105T140000Z-handoff-devcrew-audit-remediation-to-new-session.md and C:\work\mega\dev-team\docs\superpowers\plans\2026-11-05-devcrew-audit-remediation.md in full. Execute the plan with superpowers:subagent-driven-development starting at Task 0 (clone astragenie/dev-crew into C:\work\mega\dev-crew). Local commits per task on fix/audit-2026-11 only; never push, never touch dev-team. Stop and ask only if the clone fails or main has moved so far that the cited line numbers no longer resolve.
```

- Recommended execution: subagent-driven (fresh builder per task, reviewer gate per task). Tasks 2, 4, 8 change gate and runtime behaviour; a shipped mistake there re-creates the fail-open state the plan exists to fix.
- Cheaper alternative: native execution with one whole-branch review at the end; acceptable for Tasks 0, 1, 3, 7, 9, 10.

## Confidence and risks

- Confidence: high on Tasks 0 to 7, 9 (each anchored to a verified file:line and a red test); medium on Task 8 (dispatcher refactor touches 20+ hooks; measure with hyperfine before and after) and Task 10 (e2e flake cause unknown until measured).
- Risks: `claude plugin install --from <path>` syntax in Task 11 may differ on the CLI version in use (2.1.318 here); fall back to adding a local marketplace. Skill auto-discovery (#19) is only checked via `claude plugin validate --strict`; if that does not report skills, add a follow-up task.
- Open question for the owner: licence mismatch (`LICENSE` MPL-2.0 vs `plugin.json` MIT) is not in this plan.

## Suggested Next Handoff

After Task 11, hand back to the owner with `smoke-after.md`, the whole-branch review artifact, and a go/no-go on pushing `fix/audit-2026-11` and cutting devcrew 1.2.0. Horizon 2 items (roster collapse, skills cut, Workflow-tool prototype) wait for usage data per Codex #24/#27/#28.
