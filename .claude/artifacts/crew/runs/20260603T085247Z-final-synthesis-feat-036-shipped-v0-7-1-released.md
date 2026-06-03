# Final Synthesis: FEAT-036 shipped, v0.7.1 released

- Created: 2026-06-03T08:52:47Z
- Owner: lead-session
- Outcome: completed
- Summary: Implemented FEAT-036 (dedupe overlapping cost reports in `collectRecentCosts`), reviewed and approved with notes, applied FINDING-1 inline, committed under `96885cc`, then cut v0.7.1 release commit `82342a4` with annotated tag pushed to `origin/main --follow-tags`. Session also closed two trailing items from the prior session: regenerated loop snapshot (`3f7a8d4`) and filled the audit-trail row in the consumer-bump operations doc (`273ba1c`).

- Changed Files / Evidence:
  - scripts/lib/briefing/collect.mjs — new `dedupeForRollup()` helper; `collectRecentCosts` exposes `dedupedCount` and computes `sumUsdRecent` / `avgUsdRecent` / `modelBurn` over the deduped set
  - scripts/lib/briefing.mjs — `summary.costReports` now reads `costs.dedupedCount` (FINDING-1 applied: dead `?? totalReports` fallback removed)
  - tests/briefing-cost-rollup-dedupe.test.mjs — 8 new TDD scenarios; suite 229 → 237
  - CHANGELOG.md — v0.7.1 entry at top of file
  - package.json — 0.7.0 → 0.7.1
  - .claude-plugin/plugin.json — 0.7.0 → 0.7.1
  - .claude-plugin/marketplace.json — crew 0.7.0 → 0.7.1
  - README.md — pinned-release callout v0.7.0 → v0.7.1
  - docs/backlog/pending/FEAT-036.md → docs/backlog/done/FEAT-036.md
  - docs/operations/2026-06-02-consumer-crew-bump.md — audit-trail row filled (herolegion / pre-bump unknown / post crew 0.7.0 + loop 0.5.6 / hooks 10→15)
  - .claude/artifacts/loop/loop-snapshot.md — regen (grades 4→10, surfaced DEC-002..DEC-006)
  - .claude/artifacts/crew/reviews/20260603T074045Z-review-result-feat-036-dedupe-overlapping-cost-reports-in-collectrecentcos.md — reviewer approval with three findings
  - .claude/artifacts/crew/handoffs/20260603T073646Z-handoff-feat-036-dedupe-overlapping-cost-reports-in-brief-me-rollup.md — builder handoff
  - .claude/artifacts/crew/handoffs/20260603T074053Z-handoff-review-complete-feat-036-approved-with-notes.md — reviewer handoff

- Commits this session:
  - 6208bbf — docs(backlog): file FEAT-036 + ticket-filing synthesis
  - 3f7a8d4 — chore(snapshot): regen loop-snapshot
  - 273ba1c — docs(operations): fill audit-trail row (herolegion bump)
  - 96885cc — fix(briefing): dedupe overlapping cost reports in rollup (FEAT-036)
  - 82342a4 — chore(release): v0.7.1 — dedupe overlapping cost reports in brief-me rollup
  - tag v0.7.1 (annotated)

- Run / Test Steps:
  - `npm test` — 237/237 pass
  - `npm run lint` — zero warnings
  - `npm run format:check` — clean
  - `npm run typecheck` — clean
  - `node ./scripts/validate-manifests.mjs` — all four manifests on 0.7.1 post-bump
  - `node ./scripts/validate-skills.mjs` — 12 skills clean
  - `node ./scripts/validate-agents.mjs` — 6 agents clean
  - `node ./scripts/validate-slices.mjs` — clean
  - `git push origin main --follow-tags` — `96885cc..82342a4 main -> main` + `[new tag] v0.7.1 -> v0.7.1`

- Risks:
  - Downstream consumers reading `summary.costReports` will see lower numbers post-bump (deduped count, not raw count). Documented in CHANGELOG v0.7.1.
  - FINDING-3 from reviewer is unresolved: the "$X across N distinct (Y filtered)" render line is not yet wired into the brief or any agent template. Data is exposed via `costs.dedupedCount` + `costs.totalReports`, but no renderer surfaces the delta. Follow-up FEAT could be filed.
  - Loop snapshot still shows wrong backlog counts (pending: 0 / done: 4) despite filesystem holding FEAT-024 + FEAT-029 + 30+ done — separate bug in loop plugin's counter, cross-repo. Surfaced verbally this session but not filed.

- Next Step (user-action):
  - Verify v0.7.1 tag reachable on GitHub (`https://github.com/sergeymilashico/hero-crew/releases/tag/v0.7.1`).
  - Verify marketplace.json raw URL returns crew@0.7.1 (curl raw.githubusercontent.com URL).
  - Optionally smoke-test install in a throwaway consumer repo via `/plugin install crew`.
  - Consumer-repo `/crew:brief-me` verifications from prior session still owed (5 repos) — confirm dedupe rollup numbers are now sensible.

- Open follow-ups (not blocking):
  - FEAT-037 candidate: wire "$X across N distinct (Y filtered)" render line into `/crew:brief-me` output and agent templates.
  - File cross-repo ticket against `hero-crew-autonomous-loop` for loop-snapshot backlog-counter bug.
