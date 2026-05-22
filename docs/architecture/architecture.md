# Crew Engineering OS — Architecture

## Core thesis

Compose Claude Code primitives; do not build a parallel framework.

```
agent = role + universal-skills + workflow-skills + domain-skills + repo-context + task-context
```

- **role** ≤200 lines: identity + boundaries.
- **universal-skills**: always discoverable.
- **workflow-skills**: invoked per phase.
- **domain-skills**: invoked per detected stack.
- **repo-context**: `CLAUDE.md` + `.claude/crew/*.md`.
- **task-context**: the user's message + retrieved artifacts.

## Topology

- Hub-and-spoke. Lead routes; specialists own bounded scope.
- Six roles stay: lead, builder, reviewer, validator, deployer, researcher.
- No specialist builders (csharpbuilder etc.). Specializations are skills.

## Skill tiers

| Tier | Loading | Owner | Override precedence |
|---|---|---|---|
| Universal | Always discoverable | Plugin | Lowest |
| Workflow | Phase-invoked | Plugin | > Universal |
| Domain | Stack-detected | Plugin | > Workflow |
| Repo | Repo-local `.claude/skills/` | User repo | > Plugin |
| Task | Ephemeral, in-conversation | None | Highest, discarded after |

Rules:
1. One concern per skill.
2. ≤200 lines per skill.
3. Skills do not load other skills (lead composes).
4. Repo overrides plugin on conflict.
5. Task skills never persist.

## Routing

Hybrid: prescriptive heuristics in `docs/routing-table.md` + lead judgment for ambiguous cases. No LLM classifier. No pure config map.

## Memory tiers

| Tier | Storage | Defer? |
|---|---|---|
| Conversation | Claude Code native | No |
| Workflow state | `workflow-state.json` | No |
| Artifacts | `.claude/artifacts/crew/` | No |
| Repo memory | `CLAUDE.md` + `.claude/crew/*.md` | No |
| User prefs | `~/.claude/memory/` (auto memory) | No |
| Episodic vector | Vector DB / MCP | Defer until grep stops scaling (~1k artifacts) |

## What we do NOT build

- Specialist agents per stack (use skills).
- LLM-as-router (use heuristics).
- Vector memory (use markdown + grep).
- Custom DSL (use markdown + JSON).
- Cross-agent shared mutable state (use artifacts + claims).
- Replacements for Claude Code primitives.

## Phase 1 minimal viable subset

1. Reorganize `skills/` into `{universal,workflow,domain,meta}/`.
2. Author `docs/routing-table.md`.
3. Update `agents/lead.md` (≤200 lines) to reference routing-table + skill tier conventions.
4. Write this `docs/architecture/architecture.md`.
5. Run two end-to-end tasks. Observe.

## Phase 2+ (when, not whether)

- Domain skill per stack pain point (1 at a time, on-demand).
- `blocked` + `escalated_to_human` workflow badges.
- Loop iteration cap + halt for runaway autonomous loops (in autonomous-loop plugin).
- MCP integration when an external system has data the lead needs centrally.
- Artifact index file when grep exceeds 2s.
- Specialist agent only after 3+ observed misroutes of the same class.

## Backlog

See `docs/backlog/`. Companion items in `hero-crew-autonomous-loop/docs/backlog/`.
