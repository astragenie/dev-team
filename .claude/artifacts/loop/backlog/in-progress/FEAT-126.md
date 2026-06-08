---
id: FEAT-126
status: in-progress
priority: P2
category: tech-debt
target_release: null
created: 2026-06-08
updated: 2026-06-08
depends_on: []
slices: [SLICE-48, SLICE-49, SLICE-50]
derived_from: null
pm_customer_impact: 0.5
pm_effort_estimate: 0.5
pm_strategic_alignment: 0.5
pm_technical_risk: 0.5
pm_dependency_depth: 0.5
autonomous_safe: false
triage_notes: "category inferred as tech-debt from body content; priority inferred as P2 from body content; autonomous_safe inferred: AC count=0, derived_from=null → false"
started_at: 2026-06-08
---
# FEAT-126: Extract 3rd-party skills + agents from claude-code-templates into skills/ and agents/3rdparty/

> **ID note:** initially created as FEAT-122 by loop CLI 0.28.0 which doesn't read `loop.backlogRoot` from `.claude/loop.json` and computed next id from `.claude/artifacts/loop/backlog/` only. Collided with pre-existing FEAT-122 (TS Phase 5 ESLint ratchet). Renamed to FEAT-126 (next free across both trees). Earlier commits referencing FEAT-122 in messages refer to this work.

Bulk-import community skills, agents, and commands from claude-code-templates (and aitmpl.com) into this repo. After dedup against existing `agents/3rdparty/` and `skills/`, only the gap items below need import.

## Existing — already installed (no-op)

### Agents (`agents/3rdparty/`)
- `backend-architect`, `python-pro`, `cloud-architect`, `devops-engineer`, `expert-react-frontend-engineer`, `diagram-architect`, `research-coordinator`, `code-reviewer`, `ai-engineer`, `context-manager`, `task-decomposition-expert`, `typescript-pro`, `c-sharp-pro`, `database-architect`, `devops-troubleshooter`, `fact-checker`, `markdown-syntax-formatter`, `api-documenter`, `api-architect`, `frontend-developer`, `ui-ux-designer`

### Skills (`skills/domain/` or `skills/workflow/`)
- `react-engineering` (covers `react-best-practices`)
- `python-pro` (covers `python-patterns`)
- `ux-methodology` (covers `ui-ux-pro-max`, `ui-design-system` partially)
- `systematic-debugging`
- `fullstack-advisory` (overlaps `senior-fullstack`)
- `code-reviewing` / `reviewing-code`
- `prompt-engineering` (covers `senior-prompt-engineer`)
- `diagram-methodology`
- `api-documentation`
- `research-coordination`
- `ai-engineering`, `architecture-advisory`, `backend-advisory`, `frontend-advisory`, `database-architecture`, `devops-engineering`, `cloud-architecture`

## Gap — needs import

### Agents
- `development-team/mobile-developer`
- `devops-infrastructure/deployment-engineer`
- `development-tools/mcp-expert` (https://aitmpl.com/component/agent/development-tools/mcp-expert)

### Skills
- `creative-design/frontend-design` → `skills/domain/frontend-design/`
- `creative-design/tailwind-patterns` → `skills/domain/tailwind-patterns/`
- `creative-design/ui-design-system` → confirm gap vs existing `ux-methodology/references/design-systems.md`
- `creative-design/mobile-design` → `skills/domain/mobile-design/`
- `development/docker-expert` → `skills/domain/docker-expert/`
- `business-marketing/marketing-ideas` → `skills/domain/marketing-ideas/` (low priority — researcher role)
- `creative-design/executing-marketing-campaigns` → same (low priority)
- `development/webapp-testing` (https://aitmpl.com/component/skill/development/webapp-testing) → `skills/workflow/webapp-testing/`

### Commands
- `project-management/create-prd`
- `utilities/refactor-code`
- `team/architecture-review`
- `documentation/create-architecture-documentation`

## Routing rules (apply on import)

Each new skill must have `tier:` frontmatter (`universal` | `workflow` | `domain` | `meta`) per repo quality bar. Routing table entries (`docs/routing-table.md`) updated where a skill applies to a specific phase or stack.

## Acceptance

- All gap items installed to `agents/3rdparty/` or `skills/<tier>/<name>/SKILL.md`.
- `scripts/validate-skills.ts` + `scripts/validate-agents.ts` PASS.
- `docs/routing-table.md` rows added for each domain-tier skill.
- No regression in existing agent routing.

## Open questions

- Marketing skills (researcher role) — keep or drop? Repo focus is engineering tooling.
- Confirm `senior-fullstack` adds anything beyond `fullstack-advisory` before import (or skip as dup).
- Confirm `ui-design-system` content vs existing `ux-methodology/references/design-systems.md` (skip if dup).
