---
id: FEAT-204
status: pending
priority: P3
category: infra
target_release: null
created: 2026-07-12
depends_on: [FEAT-245]
slices: []
derived_from: .claude/artifacts/crew/designs/2026-07-12-tracker-provider-transition-plan.md
pm_customer_impact: 0.20
pm_effort_estimate: 0.30
pm_strategic_alignment: 0.25
pm_technical_risk: 0.35
pm_dependency_depth: 0.50
composite_score: 0.28
autonomous_safe: false
tags: [tracker-provider, task-store, sync, scoping, machine-state, phase-5]
triage_notes: |
  Scoping-only slice (researcher dispatch, 2026-07-12) for the tracker-provider
  transition plan Phase 5 ("machine state to tracker"), which was found to
  depend on a feature that does not exist -- FEAT-245/IssueBroker is a one-way
  create-only issue filer for the watcher, not a sync engine, and a backlog
  grep for "two-way sync"/"bidirectional"/"conflict handling" returned zero
  matches. This document is the scoping output; it recommends BUILD-REDUCED
  (see body) -- reduce Phase 5 to a narrow status-reconciliation capability
  and explicitly exclude grades/cost from ever moving to a tracker.
  autonomous_safe=false: recommendation changes the shape of a multi-repo
  plan (dev-team + runner) and revises an accepted invariant scope; needs
  human sign-off before any slice is derived from it. Low composite
  reflects thin, narrow value on top of Phase 4.5 (already in flight) --
  this is deliberately not scored as a green light to build.
---

# FEAT-204: Tracker-provider Phase 5 -- scope the "two-way sync" dependency

## Problem

The tracker-provider transition plan Phase 5 assumes a two-way-sync engine
that would let a tracker (GitHub Issues / Linear) become the source of truth
for machine state: the backlog tree, slice grades, and cost reports. An
architecture review (2026-07-12) found that dependency does not exist:

- `FEAT-245` ("IssueBroker") is a one-way, create-only, idempotent issue
  filer for the watcher subsystem -- it detects problems in *other* repos and
  files issues about them. It is deliberately not built on
  `TaskStoreProvider` (ISP violation: task-store is repo-bound lifecycle
  sync; watcher targets may have no `.claude/loop.json` at all).
- A full-backlog grep for "two-way sync" / "bidirectional" / "conflict
  handling" in runner returned zero matches. No FEAT has ever scoped this.

Phase 5 cannot proceed until this gap is scoped. This FEAT is that scoping
exercise -- its deliverable is a recommendation, not code.

## What exists today (trusted baseline, not re-verified here)

- `TaskStoreProvider` (runner, `src/scripts/lib/task-store/`): 7 methods --
  `publishFeature`, `publishSlice`, `closeSlice`, `postSliceComment`,
  `updateStatus`, `syncPull`, `bootstrap`. Soft-fail mandated interface-wide
  (tracker outage never blocks a build).
- Providers: GitHub (real, wraps `gh`), Linear (real GraphQL; **no
  `syncPull`/`bootstrap` in v1**), Noop (no tracker configured).
- **Local backlog tree is the source of truth today.** Providers are
  one-way, best-effort mirrors. There is no FileProvider -- the files
  themselves play that role implicitly.
- `syncPull`/`bootstrap` already implement **read-only pull** (tracker ->
  local) for GitHub. Phase 4.5, in flight from a separate agent as of this
  writing, wires that as a scheduled advisory drift-check with no
  write-back. This FEAT recommendation builds ON Phase 4.5, not instead
  of it.
- Recorded lesson (`dualwrite-drift-reconcile-pattern`): a best-effort
  source-of-truth plus a durable derived duplicate silently drifts unless
  there is an explicit reconcile/backfill step. Any two-way design must
  answer this, not just gesture at "sync."

## Analysis

### 1. Source of truth after Phase 5

**Verdict: local files stay the source of truth. The tracker never becomes
authoritative for machine state, even after Phase 5.**

This is not really a "Phase 5" decision -- it is already load-bearing on the
plan own Invariant 1 (lifecycle writes are soft-fail, tracker outage never
blocks a build) and on operational reality: `brief-me`, `loop`, and
cost-advise all read local files via CLI, and the loop must run fully
offline / with `NoopProvider` (no tracker configured at all). A design
where the tracker is authoritative would mean a build cannot safely proceed
without network access to the tracker -- a straightforward regression on an
already-accepted invariant. There is no version of "Phase 5" that can flip
this without contradicting Invariant 1 and Invariant 4 of the same plan.
So the honest framing of "Phase 5" is not "migrate machine state to the
tracker" -- it is "handle the narrow case where a human out-of-band
tracker edit needs to be reconciled back into the files," which is a much
smaller problem.

### 2. Conflict model

Two writers: a local loop/crew session (mechanical, frequent, low-stakes
per write) and a human editing the tracker UI directly (rare, high-intent
per edit -- a human closing an issue or changing a label is a deliberate
signal).

Per-entity conflict surface:

- **Feature/slice status** -- the only entity with a real two-writer
  conflict. Local session transitions status as a side effect of doing
  work (mechanical). A human can close/reopen the GitHub issue or relabel
  it directly in the tracker UI (deliberate). Conflict case: human closes
  the issue mid-slice as a "stop working on this" signal; the local
  session, unaware, continues and the next `publishFeature`/`updateStatus`
  call would push local state back over the human edit.
  **Last-write-wins here is the catastrophic case** -- it silently erases a
  human explicit stop signal with no visibility. This must never be
  auto-resolved by having the local write clobber the tracker, and the
  reverse (tracker write clobbering local mid-flight) is equally wrong
  because the loop may have a good reason to be still working (e.g. the
  human closed the wrong issue). **Neither side should auto-win single-
  handedly; the correct behavior is surface-and-pause**, not merge.
- **Grades** -- generated once, by the local grading ceremony, at slice
  close. No tracker-side UI exists to "edit a grade" on an issue/comment.
  There is no second writer, so there is no real conflict to model.
- **Cost reports** -- same shape as grades: machine-generated, append-only,
  no plausible human edit path via the tracker. No second writer.

### 3. Entity-by-entity verdict

- **Backlog features/slices (status only)**: the one entity worth any
  investment, and only for the status field -- not full record ownership.
  A tracker UI is a legitimate place for a human to signal "stop" or
  "reopen," and today that signal is invisible to the loop until someone
  notices manually. This is worth a bounded slice.
- **Grades**: **do not migrate to a tracker.** They are append-only
  telemetry with one writer. A tracker (issue comments, custom fields) is
  a strictly worse store for structured, queryable, high-volume telemetry
  than the existing JSONL. Forcing grades into the tracker to satisfy the
  plan original "Phase 5 = machine state" framing would be manufacturing
  work the entity does not need.
- **Cost reports**: same conclusion as grades, same reasoning. Leave in
  `.claude/artifacts/crew/cost/` / JSONL. No tracker involvement.

This narrows "Phase 5" from three entities to one, and from "full state" to
one field (`status`) on that one entity.

### 4. Minimal viable slice

Phase 4.5 (already in flight) delivers the read-only pull and advisory
drift surfacing -- i.e., it already detects "tracker says X, local says Y"
and logs/flags it. That is the majority of the value here: visibility.

The genuinely new increment on top, scoped to just the status-conflict case
above, is:

- When Phase 4.5 drift-check finds a **tracker-side status regression**
  relative to local (issue closed/reopened by a human while local still
  shows in-progress), escalate it from "advisory log line" to an
  **actionable pause**: block auto-continue on that feature/slice and
  require explicit human or dispatcher acknowledgment before the loop
  writes to it again.
- Forward-only auto-transitions are the only auto-resolution allowed
  (e.g., tracker closed + local already done-pending-verify -> safe to
  reconcile local to done automatically). Any transition that would
  *resume* or *reopen* work automatically is explicitly out of scope --
  that always needs a human.
- No general bidirectional merge engine, no field-by-field reconciliation
  UI, no support for grades/cost.

This is a small, bounded addition to Phase 4.5 existing drift-check
rather than a new sync engine.

### 5. Cost/benefit

The delta over "read-only mirror (Phase 4.5) + one-way publish (Phases
1-4)" is thin: it buys exactly one thing -- the loop stops silently
overwriting a human explicit "stop" signal issued through the tracker
UI, and instead pauses and asks. That is a real gap (today a human tracker
edit is invisible to the loop), but it is narrow, has never been requested
(zero backlog mentions before this scoping pass), and the full "tracker
becomes source of truth for machine state" framing in the original plan
does not survive contact with the offline/Noop constraint. Building the
general two-way-sync engine implied by the plan original Phase 5 wording
would be solving a problem that does not exist (grades/cost have no second
writer) while under-solving the one that does (status conflicts need
human escalation, not merge logic).

## Recommendation: BUILD-REDUCED

Do not build the general two-way-sync engine the plan Phase 5 implies.
Do build one narrow addition on top of Phase 4.5: escalate a detected
tracker-side status regression (human closed/reopened an issue the loop
still considers active) from an advisory log line to a blocking
acknowledgment gate, with only forward-only auto-transitions permitted and
everything else routed to a human. Grades and cost reports are excluded
from tracker migration entirely -- they have no second writer and are
better served by the existing append-only file stores. If, after Phase 4.5
ships and runs for a while, the escalation gate above turns out to still
be too narrow to matter in practice, that is grounds to close out "Phase 5"
as not needed at all rather than re-opening the full two-way-sync question.

## Acceptance criteria (for a future BUILD-REDUCED slice, not this scoping FEAT)

- GIVEN Phase 4.5 drift-check detects a tracker status that regresses
  relative to local state (e.g. issue closed while local shows
  in-progress) WHEN the next loop tick runs THEN the affected
  feature/slice is paused (no further local writes) and a human-visible
  escalation is recorded, instead of the drift being only logged.
- GIVEN a detected drift where local state has already reached a terminal
  state consistent with the tracker status (e.g. tracker closed, local
  already done-pending-verify) WHEN reconciliation runs THEN local state
  may auto-advance to reflect it, and this is the only auto-resolution
  path permitted.
- GIVEN no drift is detected WHEN the loop runs THEN behavior is
  unchanged from Phase 4.5 (no new blocking, no new writes).
- GIVEN grades or cost reports WHEN this feature ships THEN neither is
  written to, or read from, any tracker provider -- they remain
  file/JSONL-only, unchanged by this FEAT.

## Open questions for human sign-off

- Who is "the human" for the acknowledgment gate in a fully autonomous
  loop run -- does this require a notification channel that does not exist
  yet, or is a `blocked` workflow badge (already a first-class state)
  sufficient?
- Should this wait until Phase 4.5 has run in production long enough to
  show whether tracker-side human edits actually happen in practice, or
  is the risk (silently overwriting a human stop signal) severe enough
  to build the escalation gate pre-emptively?