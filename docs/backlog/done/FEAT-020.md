---
id: FEAT-020
status: done
priority: P2
category: workflow
target_release: v0.4.0
created: 2026-05-23
updated: 2026-05-24
depends_on: []
slices: [SLICE-04]
derived_from: null
autonomous_safe: true
phase: 2
started_at: 2026-05-24
completed_at: 2026-05-24
---
# FEAT-020: Multi-slice support in loop:slice-complete

## Description

`loop:slice-complete` currently auto-moves the parent feature from
`backlog/in-progress/` to `backlog/done/` as soon as all entries in
the feature's `slices: [...]` frontmatter array are completed. This
fires too eagerly when the feature is planned for multiple slices
but only the first one is registered.

**Observed**: FEAT-019 (rev2) declared a 5-slice decomposition
(SLICE-A through SLICE-E) in its body. The `slices` array, however,
only listed `SLICE-01` (the freshly-promoted SLICE-A). When SLICE-01
closed, `loop:slice-complete` saw "all slices done" and moved
FEAT-019 to `done/` — losing the SLICE-B through SLICE-E intent.

The bug repeats for any feature where the body plans more slices
than the `slices` array currently lists. Operator workaround was
"file follow-up FEAT for the missed slices", which fragments the
work and loses the parent-feature continuity.

## Scope

In scope:

- **Option A — feature-complete flag**: extend feature frontmatter
  with `feature_complete: true | false | null` (default `null`).
  `loop:slice-complete` moves the feature to `done/` only when
  `feature_complete: true` is explicitly set, regardless of slices
  array state. Backwards-compat: `null` keeps current behavior (auto-
  close when all listed slices done).

- **Option B — explicit slice-count gate**: extend feature frontmatter
  with `expected_slice_count: <int> | null`. `loop:slice-complete`
  compares completed-slice count against this number; moves to done
  only when met. Backwards-compat: `null` keeps current behavior.

- **Recommended approach**: **A** (boolean flag), simpler semantics.
  B requires the planner to predict the slice count at FEAT
  authoring, which is exactly what the rev2 → SLICE-B → SLICE-C
  evolution in FEAT-019 disproved.

- Add `--keep-feature-open` flag to `loop:slice-complete` for one-off
  override without editing frontmatter.

- Update `loop:slice-from-feature` to NOT auto-populate the slices
  array when feature frontmatter has `feature_complete: false`
  (relies on operator to set when ready).

- Update `docs/loop-control/*.md` (the slice-ceremony spec) to
  document the new flag.

Out of scope:

- Reopening FEAT-019 (already closed; treat as historical).
- UI for visualizing multi-slice progress beyond the existing
  `.claude/state/crew/slice-progress.md` dashboard.

## Acceptance hints

- A feature with `feature_complete: false` does NOT move to `done/`
  when its sole listed slice closes; stays in `in-progress/`.
- A feature with `feature_complete: true` moves to `done/` on next
  `slice-complete` regardless of slices array state.
- A feature with `feature_complete: null` (default) preserves
  current behavior: moves to `done/` when all listed slices done.
- `loop:slice-complete --keep-feature-open` overrides the close even
  when slices array is fully satisfied.
- Tests in `tests/slice-complete.test.mjs` cover all 3 flag states +
  the override flag.
- No regression: existing single-slice features continue auto-closing.

## Risks / open questions

- **Backwards compat**: existing in-progress features have no flag
  set. Migration: treat absence as `null` (current behavior). No
  forced migration.
- **Discoverability**: operators may not know about the flag.
  Mitigation: `/loop:slice-from-feature` output should mention it
  when called on a feature that names multiple slices in its body.
  Stretch goal; not required for v1.
- **Flag location**: feature vs slice frontmatter? Feature is the
  right level — slice already knows it's complete; the question is
  whether parent feature is.
