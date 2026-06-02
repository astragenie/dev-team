---
id: SLICE-13
feature: FEAT-034
title: Disambiguate aggregate vs per-slice cost reports
status: completed
priority: P2
autonomous_safe: true
created: 2026-06-02
completed_at: 2026-06-02
updated: 2026-06-02
---
# SLICE-13: Disambiguate aggregate vs per-slice cost reports

- **Priority**: P2
- **Status**: Pending
- **Author**: herolegion
- **Created**: 2026-06-02
- **Parent Feature**: FEAT-034
- **autonomous_safe**: true

## Objective

Split the single `cost-report` artifact emission into TWO labelled
variants: `cost-report-slice` (single-session, the slice that just ran)
and `cost-report-aggregate` (rollup across worktrees / sessions).
Brief-me grades `costHealth` only against the slice variant; the
aggregate surfaces in a separate `costAggregate` field for context.
Removes the false-positive "F" grade caused by aggregating reread
counts across 4-5 sibling worktrees + sessions.

## Why now

- Current cost reports show `aggregate_all: true`, `source_count: 4-5`,
  `file_re_read_count: 114`. Per-slice baseline from observation: ~9.
  The "F" grade is aggregation noise, not regression.
- FEAT-029 (deferred dogfood) measures reread reduction. Honest signal
  requires honest baseline. This slice fixes the baseline.
- Closes the v0.5.0 perf bundle (FEAT-030 + FEAT-032 + this one).
- Pre-existing single-variant cost reports must continue to parse
  (backward-compat read path). Many already-committed artifacts use
  the legacy single shape.

## In scope

1. **`scripts/lib/cost-advisor.mjs`** (~865 lines, careful surgical
   change) and/or **`scripts/lib/session-cost.mjs`** (~844 lines)
   — wherever cost-report emission happens. Change emission logic:
   - ALWAYS write a `cost-report-slice` artifact: single-source for
     the current session/slice (`source_project: <project>`,
     `aggregate_all: false`, `source_count: 1`).
   - When more than one source detected (multi-worktree / sibling
     sessions), ALSO write a `cost-report-aggregate` artifact
     (`aggregate_all: true`, `source_count: N`, `sources: [...]`).
   - Filename convention: `<ts>-cost-report-slice-<title>.md` vs
     `<ts>-cost-report-aggregate-<title>.md`.
   - Existing single-variant reports on disk continue to parse via
     the read path — do NOT change the parser to require the new
     filename pattern; keep the legacy fallback.

2. **`scripts/lib/briefing/collect.mjs`** (~777 lines) — costHealth
   computation:
   - Filter to cost reports where `aggregateAll === false` AND
     filename matches `cost-report-slice-` prefix (preferred).
   - Fall back to any cost report when no slice-variant exists
     (backward-compat for repos that haven't generated new reports
     yet).
   - Add new `costAggregate` field next to `costHealth`. Populate
     from the latest `cost-report-aggregate` artifact when present.
   - When no aggregate variant exists in the recent window, omit
     `costAggregate` (don't fake it from the legacy aggregate).

3. **`scripts/crew.mjs`** — `brief-me` JSON output: expose the new
   `costAggregate` field at the same level as the existing
   `costHealth`. Brief-me command markdown rendering (in the slash
   command file) reads both fields.

4. **`commands/crew/brief-me.md`** — update the rendering section to
   show `costAggregate` ONLY when it differs meaningfully from
   `costHealth` (e.g. aggregate `topConcern` references multi-source
   sums; otherwise the per-slice signal is the whole story). Keep
   the markdown table additions to ≤6 columns total per row to stay
   readable. If you don't touch the brief-me command markdown (it's
   long), at minimum the JSON exposes the field for downstream
   consumers.

5. **`tests/briefing-cost-health.test.mjs`** — extend with:
   - per-slice-only world: only `cost-report-slice-*.md` exists →
     costHealth grades it, costAggregate is null/absent
   - both-variants world: slice + aggregate both exist → costHealth
     grades the slice, costAggregate populated from the aggregate
   - legacy-only world (no `-slice-` or `-aggregate-` prefixed
     filenames; only existing `cost-report-*` files like the
     committed ones): backward-compat path uses any cost report
     for costHealth, omits costAggregate

6. **`tests/cost-advisor-trends.test.mjs`** OR a new test file —
   per-source/aggregate selection logic for the emitter side. Builder
   chooses based on what's easier to extend.

7. **`CHANGELOG.md`** — under v0.5.0, add a FEAT-034 bullet group
   describing the two-variant emission + backward-compat read + new
   brief-me field.

## Out of scope

- Changes to the cost-advisor's "rules" engine, signal computations,
  or grade thresholds. Only emission + selection on the read side
  changes.
- Renaming or migrating EXISTING cost-report files on disk. The
  legacy `cost-report-<title>.md` files stay as-is; the new emission
  adds `-slice-` / `-aggregate-` infixed files going forward.
- Agent prompt changes (FEAT-030, FEAT-031 territory).
- Hook changes (FEAT-029, FEAT-032, FEAT-033 territory).
- A v0.5.0 release tag. Bumped + tagged in a separate `chore(release)`
  commit once this slice closes (per user's bundle-FEAT-030+032+034
  plan).

## Acceptance criteria

Each criterion testable per `01-loop-control/EVIDENCE_RULES.md`.

- [ ] AC-1: New cost-report emissions produce a `-slice-` infixed
      file with `aggregate_all: false` and `source_count: 1`.
      Evidence: synthetic emission test writes file; filename matches;
      frontmatter values match.
- [ ] AC-2: When multi-source data exists, an additional `-aggregate-`
      infixed file is written with `aggregate_all: true`. Evidence:
      synthetic multi-source emission test.
- [ ] AC-3: When only one source exists (sole session), only the
      slice variant is written (no aggregate). Evidence: synthetic
      single-source emission test asserts the aggregate file is NOT
      present.
- [ ] AC-4: Existing legacy `cost-report-<title>.md` files
      (committed under `.claude/artifacts/crew/cost/`) continue to
      parse without errors. Evidence: parser unit test against a
      sample legacy file copied into the test fixtures.
- [ ] AC-5: `brief-me` JSON output exposes `costHealth` populated
      from the latest slice-variant cost report (or legacy fallback
      when no slice variant exists). Evidence: collect.mjs test.
- [ ] AC-6: `brief-me` JSON output exposes `costAggregate` populated
      from the latest aggregate-variant cost report when present;
      omitted (null) when no aggregate variant exists in the recent
      window. Evidence: two collect.mjs tests (with + without
      aggregate).
- [ ] AC-7: `costHealth` grade no longer includes the aggregated
      reread count from sibling worktrees when a slice variant is
      present. Evidence: collect.mjs test with synthetic 9-reread
      slice + 114-reread aggregate; `costHealth.topConcern` references
      9, not 114.
- [ ] AC-8: Backward-compat read path: if only legacy files (no
      slice/aggregate infix) exist, `costHealth` falls back to the
      most recent legacy file. Evidence: collect.mjs test with
      legacy-only fixture.
- [ ] AC-9: All 8 CI gates green per FEAT-030 Self-Verify Gate rule.
      Evidence: builder's `## Self-Verify Gates` section in handoff.
- [ ] AC-10: `CHANGELOG.md` v0.5.0 FEAT-034 bullet group describes
      the two-variant emission + backward-compat read + new
      brief-me field. Evidence: file diff.

## Done When

- all ACs PASS with evidence
- build + test pass per `.claude/loop.json` `stack.build` / `stack.test`
- Crew `review-result` artifact written with `Test Adequacy` AND
  `Validation Evidence` populated (FEAT-030 bundled-review pattern;
  fourth canonical use)
- final-synthesis written; slice moved pending → completed
- FEAT-034 moves in-progress → done

## Reviewer ladder

- Reviewer A (bundled per FEAT-030): code-bearing review. Focus areas:
  filename parsing robustness, backward-compat with legacy files,
  per-slice vs aggregate selection logic, no regression in existing
  briefing tests. Emit `--validation-evidence` if conditions hold.

## Risks

- **Large files** — cost-advisor.mjs (865 lines) and briefing/collect.mjs
  (777 lines) are big. Surgical edits required; no rewrites. Builder
  must locate the right ~30 lines per file and patch additively.
- **Filename convention split** — existing test fixtures may hard-code
  `cost-report-` filename patterns. Audit `tests/` for fixture
  collisions before changing emission.
- **Reader/writer skew** — if the emitter ships the new filenames but
  the reader still expects only the legacy pattern, costHealth goes
  blank. Ship both halves in the same commit; tests cover the round-
  trip.
- **Read-path performance** — listing two filename variants in
  `briefing/collect.mjs` could double directory scans. Keep one
  `readdir` call; filter the results in-memory.
- **Cost report attribution** — the existing aggregator collects from
  the parent project root (`~/.claude/projects/<slug>/`). Confirm the
  slice-variant emitter targets a single-project source even when
  the multi-source default is on. Read the existing `sourceProject`
  detection code; mirror its slug derivation.

## Open questions

- Where exactly does the cost-report write call happen? `cost-advisor.mjs`
  or `session-cost.mjs` or both? Builder investigation first task.
- Does `aggregate_all` get set at write time or at read time? Look at
  the `kind: cost-report` writer in `scripts/lib/artifacts.mjs` (line
  range ~125 per FEAT-030 work). If aggregate_all is computed pre-write,
  the slice emitter sets it false explicitly.
- Should brief-me's recommended-next-step text change when costHealth
  is honest-good vs aggregate-bad? Default: no — keep the recommendation
  logic stable for this slice; brief-me UX tuning is a separate FEAT.
