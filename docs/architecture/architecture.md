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

## Skill quality bar

Enforced by `scripts/validate-skills.mjs` (CI step).

**Required frontmatter** (errors):

```yaml
---
name: <kebab-case slug; must match directory name>
tier: universal | workflow | domain | meta
description: <one-line summary used for skill discovery>
---
```

**Recommended frontmatter** (warnings, non-fatal):

```yaml
owner: <github handle or team>
last_reviewed: YYYY-MM-DD       # warns when older than 180 days
triggers: [glob, signal, keyword...]
stack: <only for domain skills>  # e.g. "dotnet", "flutter"
```

**Hard rules** (errors):

- SKILL.md ≤ 200 lines.
- Directory name matches the `name` field.
- No duplicate skill names across the tree.
- `tier` must be one of the four listed above.

**Soft conventions** (warnings, encourage but do not enforce):

- A "Trigger / When to Use" heading section so the lead can quickly
  decide whether to suggest the skill.
- A "Done / Acceptance / Stop when" heading so the consumer knows when
  the skill's work is complete.
- One concrete example.

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

| # | Item | Status |
|---|---|---|
| 1 | Reorganize `skills/` into `{universal,workflow,domain,meta}/` | ✓ FEAT-001 |
| 2 | Author `docs/routing-table.md` | ✓ FEAT-002 |
| 3 | Update `agents/lead.md` (≤200 lines) to reference routing-table + skill tier conventions | FEAT-003 (creative; human review gate) |
| 4 | Skill quality bar + validator (`scripts/validate-skills.mjs`) | ✓ FEAT-007 |
| 5 | `blocked` + `escalated_to_human` workflow badges | ✓ FEAT-006 |
| 6 | This document | ✓ FEAT-004 |

## Phase 2+ (when, not whether)

- Domain skill per stack pain point (1 at a time, on-demand).
- Loop iteration cap + halt for runaway autonomous loops (✓ shipped in `autonomous-loop` plugin v0.1.18).
- Cost-advisor signal in stop-conditions (✓ shipped in `autonomous-loop` v0.1.19).
- Snapshot iteration telemetry (✓ shipped in `autonomous-loop` v0.1.20).
- Mirror crew gates in autonomous-loop slice flow (✓ shipped in `autonomous-loop` v0.1.21).
- MCP integration when an external system has data the lead needs centrally.
- Artifact index file when grep exceeds 2s (FEAT-009, deferred until measured).
- Specialist agent only after 3+ observed misroutes of the same class.

## Companion plugin sync line

| Capability | crew | autonomous-loop |
|---|---|---|
| `blocked` + `escalated_to_human` badges (writer) | ≥ 0.1.27 | — |
| Honors crew blocked/escalated in slice flow (reader) | — | ≥ 0.1.21 |

Consumers should keep both pinned together; an older `autonomous-loop`
against a newer `crew` will silently miss the new gate signals.

## Tooling gates

Every CI run on both plugin repos enforces:

1. `node ./scripts/validate-manifests.mjs`
2. `node ./scripts/validate-skills.mjs` (crew only; FEAT-007)
3. `npm run lint` — ESLint flat config, zero warnings
4. `npm run format:check` — Prettier
5. `npm run typecheck` — `tsc --noEmit` over `scripts/**/*.mjs` (JSDoc-driven; `checkJs: true` on crew, on autonomous-loop as of v0.1.20)
6. `node --test`
7. `node ./scripts/e2e-smoke.mjs` (crew only)

## Backlog

See `docs/backlog/`. Companion items in `hero-crew-autonomous-loop/docs/backlog/`.
