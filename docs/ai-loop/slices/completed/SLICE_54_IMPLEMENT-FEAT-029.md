---
id: SLICE-54
status: completed
feature: FEAT-029
phase: null
priority: P2
target_release: null
requires_validation: true
created: 2026-06-08
updated: 2026-06-08
completed_at: 2026-06-08
---
# SLICE-54: Implement FEAT-029

Implements FEAT-029. See [feature file](../../../backlog/in-progress/FEAT-029.md) for product context.

## Objective

The cost-hygiene reread hook shipped opt-in (env-var gated). Aggregate cost reports show 114 redundant Read calls per slice. Promoting to default-on cuts that waste for every consumer install.

## In scope

- Hook config file (locate and flip default-on)
- Opt-out env var preserved
- Any docs describing the hook as opt-in

## Out of scope

- Changes to hook logic itself
- Any agent prompt edits

## Acceptance criteria

- [ ] AC-1: Hook fires without any env var set on a synthetic double-Read sequence
- [ ] AC-2: `CREW_REREAD_HOOK=0` (or current opt-out var name) suppresses the hook
- [ ] AC-3: Any documentation describing hook as opt-in is updated
- [ ] AC-4: `node --test` passes, `npm run lint` zero warnings

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-029 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
