---
feature: FEAT-141
---
# Run Brief: FEAT141 SLICE68: FEAT-141 SLICE-A — rollback decision matrix + silent-failure review lens

- Created: 2026-06-11T09:05:07.692Z
- Goal: Lift the reliability + observability review surface by giving the deployer a structured rollback-vs-forward-fix matrix and giving the reviewer a silent-failure checklist for runnable changes. Pure documentation/prompt additions — no runtime change, no test contract change.
- Mode: autonomous
- Pace: unattended
- Owner: loop
- Status: active
- Summary: -
- Scope:
  - - Add a `## Rollback decision matrix` section to `skills/domain/deployment-patterns/SKILL.md` (~20 lines
  - severity × data-impact × time-to-fix → rollback / forward-fix table + tie-breaker notes).
- Extend `skills/workflow/review-gates/SKILL.md` Gate 2 with a silent-failure checklist (~25 lines): swallowed errors / catch-without-log / catch-then-continue / missing health-check tiers / inadequate fallbacks / dropped promise rejections.
- Add a reviewer prompt row in `agents/reviewer.md` skill-consultation table that routes `runnable-change` slices to the new review-gates section.
- Add a deployer prompt row in `agents/deployer.md` that routes `incident-response` / `rollback-vs-forward-fix` decisions to the new deployment-patterns section.
- Add one row to `docs/routing-table.md` for `Silent-
- Out Of Scope:
  - - New `skills/domain/observability/` skill (deferred to SLICE-B per PM triage).
- Promotion of `skills/domain/devops-engineering/references/observability.md` to a top-level skill (SLICE-B).
- Validator prompt rows (validator already cites review-gates indirectly via reviewer; no new row needed).
- Any runtime code change. Pure docs/prompt edits.
- Planned Files: -
- Next Step: Begin implementation

