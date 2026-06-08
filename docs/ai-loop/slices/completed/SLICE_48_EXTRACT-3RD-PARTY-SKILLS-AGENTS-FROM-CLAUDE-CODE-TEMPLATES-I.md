---
id: SLICE-48
status: completed
feature: FEAT-126
phase: null
priority: P2
target_release: null
requires_validation: false
created: 2026-06-08
updated: 2026-06-08
completed_at: 2026-06-08
---
# SLICE-48: Import 3 missing 3rd-party agents (mobile-developer, deployment-engineer, mcp-expert)

Implements FEAT-126 part A. See [feature file](../../../backlog/in-progress/FEAT-126.md) for product context.

## Objective

Import 3 agents not currently in `agents/3rdparty/`, sourced from claude-code-templates + aitmpl.com. Each agent file lands in `agents/3rdparty/<name>.md` with valid frontmatter and passes `scripts/validate-agents.ts`.

## In scope

- `agents/3rdparty/mobile-developer.md` — from `npx claude-code-templates@latest --agent development-team/mobile-developer`
- `agents/3rdparty/deployment-engineer.md` — from `npx claude-code-templates@latest --agent devops-infrastructure/deployment-engineer`
- `agents/3rdparty/mcp-expert.md` — from aitmpl.com (`https://aitmpl.com/component/agent/development-tools/mcp-expert`)
- Frontmatter normalization (name, description, model, tools) to match repo conventions for `agents/3rdparty/`
- Line-cap check: each agent ≤ 300 lines (governance rule); excess goes to a referenced skill

## Out of scope

- Skills import (SLICE-49)
- Commands import (SLICE-50)
- Routing-table updates in `docs/routing-table.md` (deferred — separate slice if any of the 3 needs explicit routing rows)
- Removal or renaming of existing agents

## Acceptance criteria

- [ ] AC-1: 3 new agent files exist at `agents/3rdparty/{mobile-developer,deployment-engineer,mcp-expert}.md`
- [ ] AC-2: `node scripts/validate-agents.ts` PASS with all 3 new files counted
- [ ] AC-3: Each new agent file ≤ 300 lines
- [ ] AC-4: `npm run lint` and `npm run format:check` clean (zero warnings)
- [ ] AC-5: `npm test` PASS (no regression)
- [ ] AC-6: Each new agent's frontmatter has `name`, `description`, `model` (or omit), `tools` fields populated
- [ ] AC-7: No duplicate agent name across existing `agents/3rdparty/` directory

## Done When

- all acceptance criteria PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`
- build / test commands per `.claude/loop.json` pass
- feature FEAT-126 NOT moved (still in-progress — SLICE-49 + SLICE-50 outstanding)
- Crew `final-synthesis` artifact written
- `requires_validation: false` (no observable behavior change — purely additive files for future dispatch)

## Reviewer ladder

- Reviewer A: structural — frontmatter compliance, validator output, dedup vs existing agents
- Reviewer B: content quality — description triggering effectiveness, tool list sanity, line-cap
