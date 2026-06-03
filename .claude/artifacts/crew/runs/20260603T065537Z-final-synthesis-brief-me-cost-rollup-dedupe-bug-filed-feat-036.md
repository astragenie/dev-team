# Final Synthesis: brief-me cost-rollup dedupe bug filed (FEAT-036)

- Created: 2026-06-03T06:55:37Z
- Owner: lead-session
- Outcome: completed
- Summary: User ran `/crew:brief-me` and asked how `sumUsdRecent: $13,774.62` was possible. Investigation showed the figure triple-counts a single $3,995.81 fleet window — three aggregate snapshots taken at successive checkpoints plus two nested hero-crew slice rows. Root cause located in `scripts/lib/briefing/collect.mjs:665` (`collectRecentCosts` blindly sums `report.usd` across the 5 newest files without bucketing by `(sourceProject, aggregateAll, windowStart, windowEnd)`). Filed FEAT-036 with full root-cause writeup, dedupe rule, and 5-scenario test plan.
- Changed Files / Evidence:
  - docs/backlog/pending/FEAT-036.md (new ticket — P2, autonomous_safe, target v0.7.1)
- Run / Test Steps:
  - `node ./scripts/validate-slices.mjs` — clean (silent exit).
  - `git status --short` — only FEAT-036.md untracked.
- Risks:
  - Stale loop snapshot: `.claude/artifacts/loop/loop-snapshot.md` claims `done: 4` but filesystem holds 30+ done FEATs. Snapshot regen overdue but unrelated to this ticket.
  - FEAT-036 fix changes the meaning of `sumUsdRecent` — any downstream consumer (dashboards, scripts) relying on the un-deduped sum will see lower numbers post-fix. Mitigated by the new `dedupedCount` field exposing what was filtered.
- Next Step:
  - Commit FEAT-036.md (suggested message: `docs(backlog): file FEAT-036 — dedupe overlapping cost reports in brief-me rollup`).
  - Pick up FEAT-036 implementation later; pairs naturally with the trailing audit-trail row + consumer-repo verification from the prior session.
