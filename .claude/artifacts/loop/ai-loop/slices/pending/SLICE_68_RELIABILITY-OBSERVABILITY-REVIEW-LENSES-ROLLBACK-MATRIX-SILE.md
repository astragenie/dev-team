---
id: SLICE-68
title: "FEAT-141 SLICE-A — rollback decision matrix + silent-failure review lens"
status: pending
feature: FEAT-141
phase: null
priority: P2
target_release: null
requires_validation: false
created: 2026-06-11
updated: 2026-06-11
---
# SLICE-68: FEAT-141 SLICE-A — rollback decision matrix + silent-failure review lens

Implements **2 of 3** deliverables from FEAT-141. The third (new `skills/domain/observability/` skill) is split out per PM-triage scope challenge and will land as SLICE-B if/when the observability grade dimension slips below 0.80.

See [feature file](../../../backlog/in-progress/FEAT-141.md) for product context.

## Objective

Lift the reliability + observability review surface by giving the deployer a structured rollback-vs-forward-fix matrix and giving the reviewer a silent-failure checklist for runnable changes. Pure documentation/prompt additions — no runtime change, no test contract change.

## In scope

- Add a `## Rollback decision matrix` section to `skills/domain/deployment-patterns/SKILL.md` (~20 lines, severity × data-impact × time-to-fix → rollback / forward-fix table + tie-breaker notes).
- Extend `skills/workflow/review-gates/SKILL.md` Gate 2 with a silent-failure checklist (~25 lines): swallowed errors / catch-without-log / catch-then-continue / missing health-check tiers / inadequate fallbacks / dropped promise rejections.
- Add a reviewer prompt row in `agents/reviewer.md` skill-consultation table that routes `runnable-change` slices to the new review-gates section.
- Add a deployer prompt row in `agents/deployer.md` that routes `incident-response` / `rollback-vs-forward-fix` decisions to the new deployment-patterns section.
- Add one row to `docs/routing-table.md` for `Silent-failure risk on runnable change` → reviewer; one row for `Rollback-readiness assessment` → deployer.

## Out of scope

- New `skills/domain/observability/` skill (deferred to SLICE-B per PM triage).
- Promotion of `skills/domain/devops-engineering/references/observability.md` to a top-level skill (SLICE-B).
- Validator prompt rows (validator already cites review-gates indirectly via reviewer; no new row needed).
- Any runtime code change. Pure docs/prompt edits.

## Acceptance criteria

- [ ] AC-1: Full local gate green — `bun run lint && bun run format:check && bun run typecheck && bun test`. No regressions.
- [ ] AC-2: `wc -l skills/domain/deployment-patterns/SKILL.md skills/workflow/review-gates/SKILL.md` — both ≤ 200 (current 109 + 92; budget for ~20 + ~25 additions).
- [ ] AC-3: `node ./scripts/validate-skills.ts` and `node ./scripts/validate-agents.ts` both exit 0.
- [ ] AC-4: `grep -c "Rollback decision matrix" skills/domain/deployment-patterns/SKILL.md` ≥ 1 and `grep -c "Silent-failure" skills/workflow/review-gates/SKILL.md` ≥ 1.
- [ ] AC-5: `grep -c "Silent-failure risk\|Rollback-readiness" docs/routing-table.md` ≥ 2.
- [ ] AC-6: `agents/reviewer.md` and `agents/deployer.md` each contain one new routing row pointing at the new section anchors (regex `(review-gates|deployment-patterns)`).

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-141 moved from `in-progress/` to `done/` only after **SLICE-B** also lands (or the FEAT is explicitly closed as SLICE-A-only with SLICE-B re-triaged) — single SLICE-A completion leaves FEAT-141 partially done
- Crew `final-synthesis` artifact written
- `requires_validation: false` set above — this is a pure docs/prompt change; the mandatory full gate (AC-1) is the only validation needed

## Reviewer ladder

- Reviewer A (`crew:reviewer`): correctness + regression — does the rollback matrix reflect industry practice (DORA/Google SRE rubric)? Does the silent-failure list catch the common cases without false positives? Are the prompt rows scoped tightly enough not to fire on every PR?
- Reviewer B (`crew:reviewer-validator`): docs/lint gate — skill cap compliance (both files ≤ 200), routing-table row format consistency, reviewer/deployer agent prompts stay ≤ 350 line cap.
