---
id: SLICE-194
parent: FEAT-181
status: done
priority: P2
created: 2026-07-04
title: "FEAT-181 — badge single-source-of-truth validator + catalog doc + CI gate"
stack: typescript + markdown
autonomous_safe: true
est_days: 0.5
depends_on: []
touches_files:
  - scripts/validate-badges.ts
  - docs/standards/badge-catalog.md
  - .github/workflows/test.yml
  - tests/validate-badges.test.ts
---

# SLICE-194: badge single-source-of-truth validator (FEAT-181)

## Problem
Adding a workflow badge requires editing 3 unlinked locations (CLI help in `scripts/crew.ts`,
`BADGE_HANDLERS` map in `scripts/lib/workflow-state.ts`, badge taxonomy table in an agent .md)
with no validator enforcing alignment. Drift fails silently (badge accepted by CLI, no handler → no state write).

## Scope (read-only consolidation + new CI validator + catalog doc — NO runtime/agent-prompt change)
- `scripts/validate-badges.ts` — parse the authoritative badge set from `BADGE_HANDLERS` in `scripts/lib/workflow-state.ts`, cross-check that (a) the CLI help/accept list in `scripts/crew.ts` and (b) the badge catalog doc list the same set. Mismatch → exit 1 with the drifting names.
- `docs/standards/badge-catalog.md` — generated-or-hand catalog: one row per badge (name, meaning, which handler, flags like `--note`/`--blocked-by`). This becomes the discover-by-doc surface (today devs grep).
- Wire the validator as a **hard** CI gate in `.github/workflows/test.yml` alongside the other `validate-*` steps (Node runtime per ADR-002).
- `tests/validate-badges.test.ts` — passing case + injected-drift failing case.

## Acceptance criteria
- AC-1: `node ./scripts/validate-badges.ts` exits 0 on current repo (all three locations aligned) and exits 1 naming the offender when a badge is present in `BADGE_HANDLERS` but absent from the catalog or CLI list (prove via a temp injected drift in the test).
- AC-2: `docs/standards/badge-catalog.md` lists every badge currently in `BADGE_HANDLERS`.
- AC-3: `.github/workflows/test.yml` runs the new validator as a blocking step.
- AC-4: `tests/validate-badges.test.ts` passes (aligned) and asserts the drift-detection path.

## Notes
Read `scripts/lib/workflow-state.ts` BADGE_HANDLERS + `scripts/crew.ts` help string first to derive the true current badge set. Additive only — do not change badge behavior.
