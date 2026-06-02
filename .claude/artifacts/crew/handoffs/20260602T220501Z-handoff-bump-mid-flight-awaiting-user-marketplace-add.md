---
phase: post-v0.7.0
feature: null
slice: null
kind: handoff
status: bump-mid-flight-awaiting-user-marketplace-add
mode: user-driven
created: 2026-06-02T22:05:01Z
updated: 2026-06-02T22:05:01Z
---

# Task Handoff: consumer crew@0.7.0 bump mid-flight — awaiting user marketplace-add keystroke

## Objective

User is executing the bump runbook at `docs/operations/2026-06-02-consumer-crew-bump.md`. First attempt at `/plugin marketplace add` failed due to a doc-side syntax error (extra `astra` nickname arg). Syntax was corrected in commit `7caa2ee` and pushed. Bump is paused awaiting the next user keystroke.

## Owner

User. The bump is a Claude Code CLI slash-command flow only the user can type. Lead's role is to update the audit-trail row in the runbook after the user reports pre / post versions.

## What is done

- All hero-crew docs pushed:
  - `docs/operations/2026-06-02-consumer-crew-bump.md` — runbook with corrected `/plugin marketplace add` syntax (commit `7caa2ee`).
  - `docs/investigations/2026-06-02-consumer-cost-hotspots.md` — read-only triage of citylive / authentic / hcal.
  - `docs/superpowers/specs/2026-06-02-consumer-bump-and-investigation-design.md` — brainstorming spec.
  - `docs/superpowers/plans/2026-06-02-consumer-bump-and-investigation.md` — 13-task implementation plan.
- All session synthesis + scratch + cost-report artifacts pushed.
- 229/229 tests pass on origin/main.
- `superpowers:finishing-a-development-branch` skill ran; Option 3 (keep as-is) selected; main is at terminal state.

## What is next (user-driven)

1. User runs in Claude Code:
   ```
   /plugin marketplace add sergeymilashico/hero-crew
   ```
   Or pastes `sergeymilashico/hero-crew` into the interactive dialog.
2. User installs:
   ```
   /plugin install crew
   /plugin install loop
   ```
3. User runs `/plugin list` and reports pre-bump + post-bump versions for crew + loop.
4. User restarts open Claude Code sessions in cortex / authentic / loopobserver / citylive / hcal so they pick up the new plugin binaries.
5. User runs `/crew:brief-me` in each consumer repo and confirms v0.7.0 features surface:
   - `validate-agents.mjs` in CI gate list (FEAT-035 marker)
   - `Validation Evidence` section in reviewer guidance (FEAT-030 marker)
   - `Recommended Model` / `model-selection gate` in lead workflow (FEAT-031 marker)
6. User reports back with pre / post versions.
7. Lead edits the audit-trail row in `docs/operations/2026-06-02-consumer-crew-bump.md` filling in: date, operator, pre-bump versions, post-bump versions, observations.
8. Lead commits + pushes the audit-trail update.

## Continuation plan for next session

If session resumes here:

1. Read this handoff end-to-end.
2. Ask user whether the bump completed (post-bump `/plugin list` output).
3. If completed: update audit-trail row in the runbook with reported values, commit, push.
4. If still mid-flight: re-present steps 1-6 above.
5. If aborted: leave audit-trail row as the placeholder template; bump can be re-run anytime.

## Risks or open questions

- User must complete the interactive `/plugin marketplace add` dialog. If they cancel, the bump won't proceed and consumer repos stay on whatever the prior crew version was.
- `/plugin list` output format is not documented in the runbook — if it doesn't show versions clearly, user may need to use `/plugin info crew` or inspect `~/.claude/plugins/cache/astra/crew/` directories to extract versions.
- Bump propagation requires consumer-repo Claude Code sessions to be restarted. Long-running sessions may hold stale plugin binaries until restart.
- If a regression surfaces post-bump, the runbook's Rollback section names the pin path: `/plugin install crew@0.6.0` and `/plugin install loop@0.5.4` (NOT 0.5.5 which is the known-broken release).

## Suggested next handoff

After user reports post-bump versions: a handoff capturing the audit-trail update commit + pushed-to-main confirmation. Title: `<ts>-handoff-bump-audit-trail-recorded.md`.

If user pivots away: a handoff noting the pivot + pointing to the runbook as ready-to-run-later.
