# Crew Engineering OS — Architecture

## Core thesis

Compose Claude Code primitives; do not build a parallel framework.

```
agent = role + universal-skills + workflow-skills + domain-skills + repo-context + task-context
```

- **role** ≤350 lines: identity, boundaries, escalation policy, cross-cutting rules (context efficiency, shell pre-check, report contract). FEAT-035 raised this from ≤200 to ≤300, then to ≤350 per `docs/governance.md`'s cap history; enforced via `scripts/validate-agents.ts`.
- **universal-skills**: always discoverable.
- **workflow-skills**: invoked per phase.
- **domain-skills**: invoked per detected stack.
- **repo-context**: `CLAUDE.md` + `.claude/crew/*.md`.
- **task-context**: the user's message + retrieved artifacts.

## Topology

- Hub-and-spoke. The dispatcher (a concept realized by `/crew:build` · `/crew:fix` · `/crew:ship`, not a standing agent) routes; specialists own bounded scope.
- The role taxonomy stays small — builder, reviewer, validator, deployer, researcher — but each role now has more than one concrete agent behind it as the roster grew: 22 core agents (`agents/*.md`) plus 10 vendored third-party agents (`agents/3rdparty/*.md`, lighter validation bar). Builders split by stack (`fullstack-dev`, `backend-dev`, `frontend-dev`, `dev-lite`); reviewers split by lens (`reviewer`, `reviewer-lite`, `csharp-reviewer`, `typescript-reviewer`, `architect-reviewer`); validators, specialists (`architect`, `uxdesigner`, `performance-engineer`, `qa-expert`, `refactor`, `document-writer`, `integrator`, `researcher`, `investigator`, `cloud-architect`, `aiplugin-dev`), and the deployer (`release-engineer`) round out the roster. See `docs/routing-table.md` for current dispatch rows.
- Specialist builders exist where a stack genuinely diverges (e.g. `backend-dev` for .NET); anything narrower than that stays a skill, not a new agent.

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
3. Skills do not load other skills (the dispatcher composes).
4. Repo overrides plugin on conflict.
5. Task skills never persist.

### Domain tier: advisory packs

The `domain/` tier hosts both stack-bound skills (e.g., `dotnet`, `flutter`) and **advisory packs** — subject-area discipline guides (`backend-advisory`, `security-advisory`, `prompt-engineering`, etc.) sourced from third-party authors. Advisory packs declare a `source:` + `source_version:` frontmatter pair for drift visibility against upstream. See `docs/operations/3rdparty-source-list.md` for the full distribution map.

### External plugin skills as routed dependencies

Skills from upstream plugins (`context7`, `microsoft-docs:*`, `plugin-dev:*`, `terraform-code-generation:*`, `terraform-module-generation:*`, etc.) are wired into crew agents **by routing-table row**, never by inlining their content into agent prompts. The pattern:

- **Route by signal.** Each row's "Signal" column names the observable condition (file glob, task type, error string) that should trigger the skill.
- **Name skill by exact ID.** `plugin-namespace:skill-name` for plugin skills, `crew:skill-name` for skills in this plugin's own `skills/` tree, `context7` for the MCP server. Agent prompts cite the routing-table row heading, not the bare skill ID, so an upstream rename is a one-line table edit.
- **No inlining.** Skill bodies stay external. Agent prompts get a 3–8 line bullet block citing the row + condition, not the skill text itself. Keeps agent prompts under the ≤350-line cap (FEAT-035 raised from ≤200 to ≤300, then to ≤350; enforced by `scripts/validate-agents.ts`; cap is HARD).
- **Single point of rename.** When an upstream skill renames, only the routing-table row's "Route to" column changes. Agent prompts continue to work because they reference the row heading, not the skill ID.
- **Stack-narrowing decisions documented inline.** When a routing decision narrows the surface (e.g. `azure:azure-deploy` demoted for terraform-using consumers, fallback row preserved), the row's Notes column records *why* so future maintainers do not re-litigate. See `docs/routing-table.md` for current narrowing decisions.

This pattern is what FEAT-019 institutionalised. Adding new external-plugin skill consumption is a routing-table edit + a (rarely) agent-prompt bullet — never a prompt rewrite.

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

- A "Trigger / When to Use" heading section so the dispatcher can quickly
  decide whether to suggest the skill.
- A "Done / Acceptance / Stop when" heading so the consumer knows when
  the skill's work is complete.
- One concrete example.

## Routing

Hybrid: prescriptive heuristics in `docs/routing-table.md` + dispatcher judgment for ambiguous cases. No LLM classifier. No pure config map.

### Reviewer-phase skills

A real, used pattern: the reviewer invokes external quality skills when their
path predicate matches the diff. Current wired entries:

- `plugin-dev:plugin-validator` — diff touches `agents/`, `commands/`, `hooks/`, plugin/marketplace manifests, or `.mcp.json`.
- `plugin-dev:skill-reviewer` — diff touches `skills/**/SKILL.md`.
- `context7` MCP — researcher/builder fetches live library docs when an API surface is unfamiliar.

These are **review aids**, not CI gates. The hard gates remain `scripts/validate-manifests.mjs` and `scripts/validate-skills.mjs`. The reviewer-phase skills add triggering-effectiveness and best-practice judgment on top.

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
| 3 | Update `(removed v0.41)` (≤350 lines per FEAT-035 cap raises) to reference routing-table + skill tier conventions | FEAT-003 (creative; human review gate) |
| 4 | Skill quality bar + validator (`scripts/validate-skills.mjs`) | ✓ FEAT-007 |
| 5 | `blocked` + `escalated_to_lead` workflow badges | ✓ FEAT-006 |
| 6 | This document | ✓ FEAT-004 |

## Phase 2+ (when, not whether)

- Domain skill per stack pain point (1 at a time, on-demand).
- Loop iteration cap + halt for runaway autonomous loops (✓ shipped in `loop` plugin v0.1.18).
- Cost-advisor signal in stop-conditions (✓ shipped in `loop` v0.1.19).
- Snapshot iteration telemetry (✓ shipped in `loop` v0.1.20).
- Mirror crew gates in loop slice flow (✓ shipped in `loop` v0.1.21).
- MCP integration when an external system has data the dispatcher needs centrally.
- Artifact index file when grep exceeds 2s (FEAT-009, deferred until measured).
- Specialist agent only after 3+ observed misroutes of the same class.

## Companion plugin sync line

| Capability | crew | loop |
|---|---|---|
| `blocked` + `escalated_to_lead` badges (writer) | ≥ 0.1.27 | — |
| Honors crew blocked/escalated in slice flow (reader) | — | ≥ 0.1.21 |

Consumers should keep both pinned together; an older `loop`
against a newer `crew` will silently miss the new gate signals.

## Tooling gates

Node runs dependency install (`npm ci`) and every `./scripts/*.ts` CLI/validator (the
consumer runtime, per ADR-002 — Bun for the dev/CI test suite, Node for consumer-facing
scripts); Bun runs the test/lint/format/typecheck package scripts. Current CI
(`.github/workflows/test.yml`) enforces, in order:

1. `npm ci`
2. `node ./scripts/validate-manifests.ts`
3. `node ./scripts/validate-skills.ts`
4. `node ./scripts/validate-agents.ts`
5. `node ./scripts/validate-agent-refs.ts` (phantom `crew:<name>` dispatch-reference sweep)
6. `node ./scripts/validate-dispatch-graph.ts`
7. `node ./scripts/validate-slices.ts`
8. `CREW_VALIDATE_ROUTING_TABLE=1 node ./scripts/validate-routing-table.ts` (advisory)
9. `bun run lint` — Biome, zero warnings
10. `bun run format:check` — Biome
11. `bun run typecheck` — `tsc --noEmit`
12. `bun run test` — Bun test runner (`bun test --parallel`)
13. `node ./scripts/e2e-smoke.ts`

See `CLAUDE.md`'s "CI gates" section for the authoritative, currently-maintained list —
this section summarizes it; do not let the two drift.

## Backlog

See `docs/backlog/`. Companion items in `hero-crew-loop/docs/backlog/`.
