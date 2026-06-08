---
id: SLICE-49
status: pending
feature: FEAT-122
phase: null
priority: P2
target_release: null
requires_validation: false
created: 2026-06-08
updated: 2026-06-08
---
# SLICE-49: Import 5 missing 3rd-party skills (frontend-design, tailwind-patterns, mobile-design, docker-expert, webapp-testing)

Implements FEAT-122 part B. See [feature file](../../../backlog/in-progress/FEAT-122.md) for product context.

## Objective

Import 5 skills not currently in `skills/`, sourced from claude-code-templates + aitmpl.com. Each lands in `skills/<tier>/<name>/SKILL.md` with `tier:` frontmatter and passes `scripts/validate-skills.ts`.

## In scope

- `skills/domain/frontend-design/SKILL.md` — from `creative-design/frontend-design`
- `skills/domain/tailwind-patterns/SKILL.md` — from `creative-design/tailwind-patterns`
- `skills/domain/mobile-design/SKILL.md` — from `creative-design/mobile-design`
- `skills/domain/docker-expert/SKILL.md` — from `development/docker-expert`
- `skills/workflow/webapp-testing/SKILL.md` — from aitmpl.com (`https://aitmpl.com/component/skill/development/webapp-testing`)
- Tier assignment per quality bar (domain vs workflow)
- Frontmatter normalization (name, tier, description)
- Line-cap check: each SKILL.md ≤ 200 lines (validator rule); overflow goes to `references/*.md`

## Out of scope

- Agents import (SLICE-48)
- Commands import (SLICE-50)
- Confirm-vs-existing items (`ui-design-system`, `senior-fullstack`, marketing skills) — separate decision, deferred
- Routing-table updates in `docs/routing-table.md` — separate slice if needed

## Acceptance criteria

- [ ] AC-1: 5 new SKILL.md files exist at the paths above
- [ ] AC-2: `node scripts/validate-skills.ts` PASS with all 5 new files counted
- [ ] AC-3: Each SKILL.md ≤ 200 lines; overflow content lives in `references/*.md` inside the same skill folder
- [ ] AC-4: Each new skill's frontmatter has `name`, `tier` (∈ universal|workflow|domain|meta), `description` populated
- [ ] AC-5: `npm run lint` and `npm run format:check` clean (zero warnings)
- [ ] AC-6: `npm test` PASS (no regression)
- [ ] AC-7: No duplicate skill name across `skills/` tree

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-122 NOT moved (still in-progress — SLICE-50 outstanding)
- Crew `final-synthesis` artifact written
- `requires_validation: false` (additive skill files, no runtime behavior change)

## Reviewer ladder

- Reviewer A: structural — tier correctness, frontmatter, validator output, dedup
- Reviewer B: content quality — description triggering effectiveness, references layout, line-cap discipline
