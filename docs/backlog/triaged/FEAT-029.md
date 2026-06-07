---
id: FEAT-029
title: Promote cost-hygiene reread hook to default-on
priority: P0
status: triaged
category: performance
target_release: v0.3.12
created: 2026-06-01
updated: 2026-06-07
depends_on: []
slices: [SLICE-09]
derived_from: null
autonomous_safe: false
deferred: true
triage_notes: "autonomous_safe inferred: AC count=0, derived_from=null → false"
---
## Description

The cost-hygiene reread hook shipped in v0.3.11 as `CREW_COST_HYGIENE`
env-var-gated and default-off. Aggregate cost reports show 114 redundant
Read calls per slice across recent runs. Promoting the hook to default-on
after a dogfood pass would cut that waste for every consumer install
without further user action.

## Acceptance hints

- Dogfood `CREW_COST_HYGIENE=1` in one real session; capture
  `.claude/state/` reread-tracker file as evidence handoff before
  flipping the default.
- Flip default in `hooks.json` (or wherever the env-var gate lives) so
  the PreToolUse + PostToolUse Read matchers fire without the
  env-var being set.
- Keep an explicit opt-out path (`CREW_COST_HYGIENE=0` or equivalent)
  so users can disable.
- Bump `package.json` and `.claude-plugin/marketplace.json` to v0.3.12.
- `CHANGELOG.md` entry under v0.3.12.
- e2e-smoke confirms a fresh repo install picks up the default-on
  behavior without setting any env var.

## Notes

- Direct follow-on to v0.3.11 cost-hygiene reread hook work.
- Sits in the `next` field of the last completed run (FEAT004 SLICE08).
- Source analysis: `.claude/artifacts/crew/handoffs/20260601T115349Z-handoff-perf-stabilization-feat-backlog-awaiting-user-choice.md`.
