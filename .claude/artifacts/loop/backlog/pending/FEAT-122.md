---
id: FEAT-122
status: pending
priority: null
category: null
target_release: null
created: 2026-06-08
updated: 2026-06-08
depends_on: []
slices: []
derived_from: null
---
# FEAT-122: Extract 3rd-party skills + agents from claude-code-templates into skills/ and agents/3rdparty/

Bulk-import community skills and agents from claude-code-templates (and aitmpl.com) into this repo, routed to per-agent skill folders and a shared `agents/3rdparty/` folder.

## Skills (target: skills/)

### frontend
- npx claude-code-templates@latest --skill creative-design/frontend-design
- npx claude-code-templates@latest --skill web-development/react-best-practices
- npx claude-code-templates@latest --skill creative-design/tailwind-patterns

### backend
- npx claude-code-templates@latest --skill development/python-patterns

### uxdesigner
- npx claude-code-templates@latest --skill creative-design/ui-ux-pro-max
- npx claude-code-templates@latest --skill creative-design/ui-design-system
- npx claude-code-templates@latest --skill creative-design/mobile-design

### reviewer
- npx claude-code-templates@latest --skill development/code-reviewer
- npx claude-code-templates@latest --skill development/systematic-debugging

### builder
- npx claude-code-templates@latest --skill development/senior-fullstack
- npx claude-code-templates@latest --skill development/systematic-debugging

### integrator
- https://aitmpl.com/component/skill/development/webapp-testing

### pm
- npx claude-code-templates@latest --skill development/senior-prompt-engineer
- npx claude-code-templates@latest --command project-management/create-prd

### deployer
- npx claude-code-templates@latest --skill development/docker-expert

### researcher
- npx claude-code-templates@latest --skill business-marketing/marketing-ideas
- npx claude-code-templates@latest --skill creative-design/executing-marketing-campaigns

### architect
- refactor: npx claude-code-templates@latest --command utilities/refactor-code
- arch review: npx claude-code-templates@latest --command team/architecture-review
- generate architecture docs: npx claude-code-templates@latest --command documentation/create-architecture-documentation

## Agents (target: agents/3rdparty/)

- npx claude-code-templates@latest --agent development-team/backend-
- https://aitmpl.com/component/agent/programming-languages/python-pro
- npx claude-code-templates@latest --agent development-team/mobile-d
- npx claude-code-templates@latest --agent development-team/devops-engineer
- https://aitmpl.com/component/agent/development-tools/mcp-expert
- npx claude-code-templates@latest --agent devops-infrastructure/deployment-engineer
- npx claude-code-templates@latest --agent devops-infrastructure/clo
- npx claude-code-templates@latest --agent deep-research-team/research-coordinator
- npx claude-code-templates@latest --agent web-tools/expert-react-fr
- npx claude-code-templates@latest --agent documentation/diagram-architect

## Notes

- Some entries in the source list are truncated names (backend-, mobile-d, clo, expert-react-fr) — resolve to full slugs during triage.
- Several skills + agents already exist in this repo under crew:3rdparty:* and loop:3rdparty:*; dedupe before import.
- Decide routing convention: per-role subfolders under `skills/` vs flat `skills/3rdparty/` mirror of the agents folder.