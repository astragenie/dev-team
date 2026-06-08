---
id: SLICE-58
status: completed
feature: FEAT-130
phase: null
priority: P2
target_release: null
requires_validation: false
created: 2026-06-08
updated: 2026-06-08
completed_at: 2026-06-08
---
# SLICE-58: Implement FEAT-130

Implements FEAT-130. See [feature file](../../../backlog/in-progress/FEAT-130.md) for product context.

## Objective

`.claude/artifacts/crew/` accumulates indefinitely; file scanning (brief-me, wake-up) slows down over time as artifact count grows.

## In scope

- `scripts/prune-artifacts.ts` — new pruning script with `--older-than`, `--dry-run`, `--repo` flags
- `commands/prune-artifacts.md` — registers `crew prune-artifacts` command

## Out of scope

- Any change to existing scripts or commands
- Modifying artifact retention policy

## Acceptance criteria

- [ ] AC-1: `--dry-run` lists files without deleting; destructive mode deletes only files older than threshold
- [ ] AC-2: Rejects invalid `--older-than` values (NaN, negative, zero) with non-zero exit
- [ ] AC-3: Unit tests for age-filter pure function pass; `npm test` and `npm run lint` clean

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-130 moved from `in-progress/` to `done/`
- Crew `final-synthesis` artifact written
- (pure refactors / mechanical changes: set `requires_validation: false` in frontmatter
   above to waive the validation gate — no badge needed at close time)

## Reviewer ladder

- Reviewer A: ...
- Reviewer B: ...
