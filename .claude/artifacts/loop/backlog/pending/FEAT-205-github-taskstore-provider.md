---
id: FEAT-205
status: pending
priority: P1
category: infra
target_release: null
created: 2026-07-12
depends_on: []
slices: [S1, S2, S3, S4, S5]
derived_from: .claude/artifacts/crew/designs/2026-07-12-tracker-provider-transition-plan.md
pm_customer_impact: 0.75
pm_effort_estimate: 0.45
pm_strategic_alignment: 0.85
pm_technical_risk: 0.40
pm_dependency_depth: 0.30
composite_score: 0.68
autonomous_safe: false
tags: [tracker-provider, task-store, github, ingest, auto-mode, dora, watcher, fleet]
triage_notes: |
  Enables GitHub as the live task store across the fleet. The GithubProvider
  ALREADY EXISTS and works (runner-plugin, 254 lines) — this FEAT is about
  turning it on where it isn't, and building the ONE direction that does not
  exist anywhere: tracker -> local (ingest).

  autonomous_safe: false — S2 (publish) and S3 (ingest) create/modify real
  GitHub issues across repos. Needs a human on the dry-run before any --apply.
---

# FEAT-205 — GitHub as the live task store (publish + ingest + fleet rollout)

## Problem

**The loop and GitHub are two disconnected work queues.** The loop can publish to
a tracker but cannot ingest from one. Result, measured 2026-07-12:

| Repo | Loop-visible | GitHub-visible | Overlap |
|---|---|---|---|
| dev-team | 3 live FEATs | 30 open issues | **0** — provider is `NoopProvider` |
| runner-plugin | 194 FEATs | 13 open ad-hoc issues the loop can't see | partial |

Two symptoms of one gap:

1. **Publish gap** — dev-team resolves to `NoopProvider`; nothing the loop does
   appears in GitHub at all.
2. **Ingest gap (the important one)** — an issue filed in GitHub, by a human or
   by the watcher, is **structurally invisible to the loop**. It can never be
   picked up, scored, sliced, or dispatched. This direction has never been built
   in any provider.

The ingest gap is the hard blocker on the stated program goals: auto mode needs a
trustworthy work queue, and the Phase-D watcher vision (*"watcher detects a bug →
files an issue → the team fixes it in real time"*) is **already half-built** —
`FEAT-245`/IssueBroker can file. The loop simply cannot see what was filed.

## What already exists (do not rebuild)

- **`GithubProvider`** — `runner-plugin/src/scripts/lib/task-store/providers/github-provider.mts`,
  254 lines, real and working. Wraps the `gh`-CLI `github-sync` layer.
- **`TaskStoreProvider`** interface (7 methods): `publishFeature`, `publishSlice`,
  `closeSlice`, `postSliceComment`, `updateStatus`, `syncPull`, `bootstrap`.
  **Soft-fail is mandated** — every method resolves without throwing when the
  backend is down.
- **`getProvider(config, repoPath)`** — resolves from `taskStore.provider`
  (`github` | `linear` | `noop`), called from `loop.mts`'s three lifecycle sites
  (FEAT-251, done).
- **Auto-close on done** — PR #487 (merged 2026-07-12). A slice/feature reaching
  `done` now closes its tracker issue **in code**, not by an agent remembering.
- **Drift detection** — `loop github drift` (PR #485). Read-only; proven safe
  (asserts byte+mtime identity of local files after a drift-detecting run).
- **Reconcile** — `loop github reconcile` (in flight). Closes the accumulated
  `done`-but-`OPEN` backlog; publishes live FEATs; **reports** tracker-only issues
  without acting on them.

**⚠️ `syncPull` / `bootstrap` are NOT read-only.** `syncPull` calls `patchBody` +
`fs.writeFile` on local FEAT files; `bootstrapFromGithub` creates them. They cannot
be reused for a safe ingest path — this is why `checkSyncDrift()` was written
separately in #485. **Do not reuse them for S3.**

## Non-goals (explicitly out of scope)

- **The tracker does NOT become the source of truth.** Local files stay
  authoritative. Two independent architecture reviews (2026-07-12) rejected the
  SoT flip, and the drift check then proved them right: **125 of 125 status
  mismatches were `done`-locally / `OPEN`-in-tracker.** Adopting the tracker as
  truth would have adopted 125 wrong statuses and re-dispatched builders at
  already-merged work. See `2026-07-12-A2-tracker-sot-review.md`.
- **Do NOT publish `done` FEATs.** dev-team has 165. Creating 165 issues purely to
  close them is noise. GitHub is the **working view, not the archive**; git already
  holds the history.
- No Linear work here (`LinearProvider` exists; this FEAT is GitHub-only).
- No two-way sync / conflict resolution (FEAT-204, superseded — with one source of
  truth there is nothing to reconcile).

## Slices

### S1 — Provider config + fleet enablement
Wire `taskStore.provider: "github"` into `.claude/loop.json` for dev-team, and
document the one-line enablement for the other repos. Verify `getProvider()`
resolves `GithubProvider` and that all three `loop.mts` lifecycle sites publish.
Confirm `NoopProvider` remains the safe default for repos that opt out.

### S2 — Publish live FEATs (not the archive)
Publish **only** non-`done` FEATs (pending / triaged / in-progress). `done` FEATs
are skipped. Reuse the reconcile command's publish path; do not fork it. Idempotent
— a re-run must not create duplicates.

### S3 — Ingest: GitHub issue → FEAT (**smaller than it looks — half exists**)

**⚠️ CORRECTION (verified against code 2026-07-12): the single-issue ingest path
ALREADY EXISTS.** `loop backlog add --from-issue <url>` fetches a GitHub issue via
`src/scripts/lib/from-issue.mts` (`fetchIssue` → title/body/number/url) and
pre-fills FEAT frontmatter. It is wired at `loop.mts:861`. **Do not rebuild it.**

What is genuinely missing is narrower:

- **Discovery** — *which* issues need ingesting. `checkSyncDrift()`'s `trackerOnly`
  list already answers this exactly (runner: 13 genuinely-open ad-hoc issues;
  dev-team: 30). Wire the existing detector to the existing fetcher.
- **Idempotency / linkage (the crux)** — an issue already linked to a FEAT must
  never produce a second one. Stamp the issue number into FEAT frontmatter and key
  on it. **Must not ingest issues the loop itself published** (publish → ingest →
  duplicate FEAT is a real self-loop). Reuse the linkage `checkSyncDrift()` already
  uses to classify "linked" vs "tracker-only."
- **Selective and bulk modes** — `--issue N`, `--label X`, or an explicit `--all`.
  Auto-ingesting 30 issues unasked is a footgun.
- **`--dry-run` by default**, printing the plan.

Ingested FEATs are **unscored** (`status: pending`) — they enter the normal PM
triage path and do not jump the queue.

Read-only against the tracker; **writes only new local FEAT files**, never modifies
existing ones.

### S4 — Standing drift gate
Schedule `loop github drift` in CI; alert on non-zero drift. This is the immune
system for S1–S3 — it is how "the tracker is honest" stays true rather than being
asserted. Would have caught all nine of the merged-but-never-closed issues found
by hand on 2026-07-12.

### S5 — Fleet rollout
Per repo, in this order: `drift` (see it) → `reconcile --dry-run` (plan it) →
human eyeball → `--apply` → enable provider (S1) → publish live (S2).
Scope: ~1,150 FEATs across 10 repos — memory (322), runner/astrarunner (258),
runner-plugin (194), dev-team (142), sales (79), astramemory-local (75),
authentic (60), citylive/plugins-common/hr-team (24).
**Requires a plugin release first** so every repo inherits #485/#487/reconcile
without being touched individually.

## Acceptance criteria

**AC1 — provider resolves (S1)**
GIVEN a repo with `taskStore.provider: "github"` in `.claude/loop.json`
WHEN `getProvider()` runs
THEN it returns `GithubProvider`, and the three `loop.mts` lifecycle sites publish
through it.

**AC2 — publish is live-only and idempotent (S2)**
GIVEN a backlog with live and `done` FEATs
WHEN publish runs
THEN only non-`done` FEATs become issues, `done` FEATs are skipped, and a re-run
creates zero duplicates.

**AC3 — ingest creates a dispatchable FEAT (S3)**
GIVEN an open GitHub issue with no linked FEAT
WHEN `loop github intake --issue N` runs
THEN a local FEAT file is created with the issue number stamped in frontmatter,
`status: pending`, and it is pickable by the normal PM triage path.

**AC4 — ingest is idempotent and non-self-referential (S3)**
GIVEN an issue already linked to a FEAT (including one the loop itself published)
WHEN intake runs again
THEN no second FEAT is created and no local file is modified.

**AC5 — dry-run writes nothing (S2, S3)**
GIVEN any reconcile/publish/intake invocation without `--apply`
WHEN it runs
THEN zero tracker mutations and zero local writes occur, and a precise plan is
printed. **A test must assert the provider is never called with a mutation.**

**AC6 — soft-fail preserved (all slices)**
GIVEN the tracker is unavailable (network down, `gh` unauthenticated, rate-limited)
WHEN any lifecycle operation runs
THEN it warns and continues; the local operation still succeeds; nothing throws.
**A slice must always be closable with GitHub down.**

**AC7 — local stays authoritative (all slices)**
GIVEN any operation in this FEAT
WHEN it runs
THEN the local backlog is never mutated by tracker state. (Ingest creates a NEW
FEAT — it never overwrites an existing one.)

**AC8 — drift stays near zero (S4)**
GIVEN the standing drift gate
WHEN a slice/feature completes
THEN drift does not increase, and CI alerts if it does.

## Risks

- **Rate limits (MAJOR).** 125+ closes × 10 repos, plus publish and ingest, plus a
  parallel agent fleet. Batch, back off on 403/429, keep runs resumable. This is
  the most likely operational failure, far more likely than an outage.
- **Ingest self-loop (MAJOR).** Publish creates an issue → intake ingests it → a
  duplicate FEAT. Linkage-keyed idempotency (AC4) is the guard; it must be tested
  explicitly, not assumed.
- **Bulk-apply footgun (MAJOR).** A command that can close 125 issues or create 30
  FEATs must default to dry-run and support `--limit`. Human eyeball before
  `--apply`, always.
- **Noise (MEDIUM).** Publishing the archive would bury the working view. Mitigated
  by the live-only rule — but re-check it during S2, because it is easy to
  regress into "publish everything."
- **Reusing `syncPull`/`bootstrap` (MEDIUM).** They write locally. A builder
  reaching for the obvious-looking method would violate AC7. Called out above.

## Evidence

- `.claude/artifacts/crew/runs/20260712-drift-report-analysis.md` — the 125-instance
  drift, all one shape.
- `.claude/artifacts/crew/designs/2026-07-12-A2-tracker-sot-review.md` — why the
  tracker does NOT become source of truth (18 of 27 frontmatter fields have no
  tracker-native home).
- runner-plugin PR #485 (drift), #487 (auto-close), reconcile (in flight).
- Nine issues closed by hand 2026-07-12 (#392, #164, #435, #437, #439, #481, #389,
  #394, #427) — the visible tip of the 125.
