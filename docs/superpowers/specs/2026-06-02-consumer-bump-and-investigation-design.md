---
date: 2026-06-02
topic: Consumer crew@0.7.0 bump + per-repo cost-hotspot investigation
status: design-approved
related:
  - .claude/artifacts/loop/retrospectives/2026-06-02-cross-repo.md
  - .claude/artifacts/loop/retrospectives/2026-06-02-cross-repo-cost-efficiency.md
  - .claude/artifacts/crew/runs/20260602T160653Z-final-synthesis-cross-repo-retrospective-cost-efficiency-cost-advise-analysi.md
---

# Design: Consumer crew@0.7.0 bump + cost-hotspot investigation

## Purpose

Roll out crew@0.7.0 + loop@0.5.6 to the five consumer repos
(cortex, authentic, loopobserver, citylive, hcal) and write a
read-only triage of the three cost-report hotspots surfaced by
the 2026-06-02 cross-repo cost-efficiency analysis:

- **citylive** — `tool-failure-rate` flagged in 12 of 20 recent
  cost reports (low severity).
- **authentic** — `cost-regression` flagged in 8 of 20 recent
  cost reports (high severity).
- **hcal** — `large-tool-output` flagged in 8 of 20 reports plus
  the highest reread average across all repos (32.7 avg, 315 max).

## Approach selected

**A — two separate docs in hero-crew, then user runs the bump.**

Rejected alternatives:
- **B (combined health doc)** — mixes "you-run-this" with
  "engineering analysis"; different audiences want different
  things; clean separation wins.
- **C (investigation only, skip bump doc)** — relies on user
  memory for the bump commands; rollout date is not captured
  anywhere durable.

## Architecture

Two new documents land in `hero-crew` on the same commit.
No changes outside `hero-crew`. Consumer repos are read read-only
during investigation; the bump itself is a user-side action.

### Document 1 — Operations doc

**Path:** `docs/operations/2026-06-02-consumer-crew-bump.md`

**Size:** ≤80 lines

**Sections:**

- **Purpose** (1 paragraph) — what this doc is, what it triggers,
  why now.
- **Pre-check** — verify the user has Claude Code installed
  (POSIX: `which claude`; PowerShell: `(Get-Command claude).Source`),
  verify the v0.7.0 tag exists on the remote
  (`gh release view v0.7.0 -R sergeymilashico/hero-crew`),
  verify v0.5.6 tag for loop similarly.
- **Bump commands** — exact Claude Code slash-command sequence:

  ```
  /plugin marketplace add astra https://github.com/sergeymilashico/hero-crew
  /plugin install crew@astra
  /plugin install loop@astra
  ```

  Plus the upgrade form for already-installed users:
  `/plugin update crew@astra` + `/plugin update loop@astra`.

- **Verification per repo** — for each of cortex / authentic /
  loopobserver / citylive: open a Claude Code session in the
  repo, run `/crew:brief-me`, confirm the routing-table /
  cost-advise output references crew@0.7.0 features
  (validate-agents.mjs gate, validation-evidence bundling,
  model-selection gate). For hcal: same, plus confirm loop@0.5.6
  is what the plugin manifest reports.

- **Rollback** — explicit pin to the prior version if a regression
  surfaces: `/plugin install crew@0.6.0` / `/plugin install loop@0.5.5`.
  Note that v0.5.5 of loop is the known-broken release; rollback
  to 0.5.4 if needed.

- **Audit-trail** — append a single dated line to a
  log section at the bottom of this doc capturing the bump date
  + which user ran it + observed-version-after-bump. This doc
  doubles as the rollout log.

### Document 2 — Investigation doc

**Path:** `docs/investigations/2026-06-02-consumer-cost-hotspots.md`

**Size:** ~150 lines

**Frontmatter:** date, source-repos, kind, links to the
cross-repo retros.

**Header:** 1 paragraph linking to the cross-repo retrospective
+ cost-efficiency analysis, explaining that this doc triages
the three repo-specific hotspots those analyses surfaced.

**Three per-repo sections** (citylive / authentic / hcal), each
with this fixed shape:

1. **Symptom** — what the cost-advise or metric showed; copy the
   key line from the cost-advise artifact.
2. **Evidence** — file paths to specific cost reports (2-3 latest
   + 1 worst-case) plus key field values pulled from each
   (usd, file_reread_count, tool_failure_rate, etc.).
3. **Investigation steps** — bulleted list of what I read:
   cost-report markdown frontmatter, recent session-log payloads
   under `~/.claude/projects/<sourceProject>/`, slice or backlog
   frontmatter of the run that produced the report.
4. **Root-cause hypothesis** — best guess after triage. Marked
   "hypothesis" because triage is read-only — confirmation
   requires a follow-up slice.
5. **Recommended fix path** — concrete next action: a referenced
   existing FEAT (e.g. FEAT-029 promotion for hcal rereads), a
   new FEAT candidate (FEAT-036/037/038 already proposed in the
   cost-efficiency analysis), or a config change. If no action
   is warranted, say so explicitly ("metric is noise; ignore").
6. **Follow-up FEAT candidate** — if this investigation surfaces
   a new candidate not already in the backlog, propose an ID
   (FEAT-039+) and a one-sentence scope.

**Cross-cutting findings section** at the end — anything that
affected two or more repos. Aggregates patterns visible only
when the three triages sit next to each other.

## Investigation methodology

Read-only, bounded. Same shape applied per repo:

1. `ls -t <repo>/.claude/artifacts/crew/cost/ | head -5` — pick
   the latest five cost-report markdowns.
2. Read the two most recent + the worst-case (highest USD or
   largest hotspot metric for the specific repo). Cap: five reads
   per repo.
3. Read the latest cost-advise artifact for that repo to confirm
   what `cost-advisor.mjs` flagged.
4. Cross-reference `source_project` frontmatter field against the
   session-log directory existence
   (`ls ~/.claude/projects/<sourceProject>/`). If the directory
   doesn't exist, that's a likely root cause for zero-emission
   reports (citylive). If the directory exists but no recent
   session-log files match the report's window, that's a probable
   reader-source mismatch.
5. **citylive-specific** — check whether any historical cost
   report (not just the recent 20) has non-zero `usd` /
   `messages`. If yes, reporter is intermittently working,
   not fundamentally broken.
6. **authentic-specific** — diff the frontmatter of one
   usd-present report against one usd-missing report (both
   exist in authentic's archive). Identify the divergent field
   to pinpoint where the writer's USD path breaks.
7. **hcal-specific** — check whether `CREW_COST_HYGIENE` env var
   appears in any recent session-log file. If absent, the
   FEAT-029 hook never runs in hcal sessions; that's the obvious
   first lever.
8. No edits. No commits in consumer repos. All findings written
   to the hero-crew investigation doc.

## Data flow

Both docs sit in `hero-crew` and reference artifacts in their
source repos by absolute path. No file copies into hero-crew.
Investigation findings cite consumer-repo artifacts by full path
(`C:\work\mega\<repo>\.claude\artifacts\crew\cost\<file>.md`)
so any reader on the same machine can verify the evidence.

The bump doc names commands the user runs in Claude Code; this
doc has no automation that runs the bump itself.

## Error handling

- **Missing artifact dir** in a consumer repo → investigation
  section records the absence as the finding; no error.
- **Unreadable cost report** (malformed frontmatter) → skip,
  record the skip in the investigation section.
- **Pre-existing dirty working tree** in cortex / authentic
  (noted in prior session) → investigation is read-only,
  no conflict possible.
- **Bump command fails** (user-side) → rollback section names
  the prior-version pin path; doc itself doesn't recover.

## Testing

- **Doc 1 (operations)** — no automated tests. Verification is
  the user successfully running the bump and observing v0.7.0
  features available in a consumer repo session.
- **Doc 2 (investigation)** — no automated tests. Each finding
  must cite a specific cost-report file path; that's the
  evidence trail a reviewer can spot-check.

## Done when

- Both docs committed + pushed in `hero-crew` on `main`.
- Each investigation section cites at least one specific
  cost-report file path as evidence.
- Each investigation section names a concrete next action: an
  existing FEAT to act on, a new FEAT candidate to add to the
  backlog, or an explicit "no action needed because X".
- Cross-cutting findings section lists every pattern that
  affected two or more of the three repos investigated.

## Out of scope

- Running the bump commands (user-side action; doc gives
  instructions only).
- Any code changes in consumer repos.
- Fixes in `hero-crew` based on investigation findings (those
  become future slices, not part of this work).
- Investigation of cortex (already healthiest cost profile per
  the cross-repo analysis) or extending loopobserver beyond the
  existing retrospective.
- Per-repo `marketplace.json` files — the bump approach is
  user-global install, so no per-repo version-pin files are
  created.

## Risks

- User may revise sections after seeing the written spec — fine,
  brainstorming is iterative.
- Investigation may surface a deeper issue than triage-only
  resolves — spec explicitly defers fixes to future slices.
- hcal sits at `/c/work/mega/hero-crew-autonomous-loop` as both
  consumer of crew@0.7.0 AND source of loop@0.5.6. The bump
  applies to hcal in its consumer role; its source role is
  already at the target version.
- v0.5.5 of loop is the known-broken release; the rollback
  section in the operations doc must call out v0.5.4 as the
  safe-fallback target, not v0.5.5.
