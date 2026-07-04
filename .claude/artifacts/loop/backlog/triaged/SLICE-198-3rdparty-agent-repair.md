---
id: SLICE-198
parent: ARCH-REVIEW-2026-07-04
status: triaged
priority: P2
created: 2026-07-04
title: "3rdparty agent-pack repair — Claude Code tool names (§2.6) + strip foreign peer boilerplate"
stack: markdown
autonomous_safe: true
est_days: 0.5
depends_on: []
touches_files:
  - agents/3rdparty/expert-react-frontend-engineer.md
  - agents/3rdparty/frontend-developer.md
  - agents/3rdparty/mobile-developer.md
  - agents/3rdparty/refactoring-specialist.md
  - agents/3rdparty/database-architect.md
---

# SLICE-198: 3rdparty agent repair (arch §2.6)

Disjoint from SLICE-197 (touches only `agents/3rdparty/**`) → parallelizable in the same wave.

## Acceptance criteria
- AC-1: `expert-react-frontend-engineer.md` `tools:` frontmatter rewritten from VS Code Copilot tool names (changes, codebase, editFiles, …) to Claude Code names (Read, Write, Edit, Bash, Glob, Grep, WebFetch as appropriate). It is a live routing target from `uxdesigner.md` — must be dispatchable.
- AC-2: `frontend-developer.md`, `mobile-developer.md`, `refactoring-specialist.md`, `database-architect.md` — strip the foreign `context-manager` "Communication Protocol" JSON boilerplate and invented peer names (postgres-pro, neon-database-architect, websocket-engineer, tech-lead, documentation-engineer, legacy-modernizer, code-reviewer), replacing with this repo's real agents OR a clear `reference-only / non-dispatchable` header comment.
- AC-3: `node ./scripts/validate-agents.ts` stays green (0 errors); no core-agent file touched.
- AC-4: reviewer confirms no invented `crew:<name>` peer survives in the 5 files.

## Notes
Pure prompt-frontmatter/body cleanup on 3rdparty agents. If the harness enforces `tools:` literally, AC-1 restores actual tool access — verify with a smoke dispatch note in the handoff.
