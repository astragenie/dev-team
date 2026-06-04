---
title: Distribute third-party skills across crew tier taxonomy
date: 2026-06-04
status: draft
authors: [lead]
related: []
---

# Distribute third-party skills across crew tier taxonomy

## Problem

11 third-party skills (sourced from `aitmpl/development/*` via `claude-code-templates`) and 21 third-party agents (sourced from `aitmpl/<category>/*`) currently sit in `skills/3rdparty/` and `agents/3rdparty/`. They are:

- Off-taxonomy — `3rdparty/` is not one of the four declared tiers (`universal`, `workflow`, `domain`, `meta`).
- Breaking CI — `scripts/validate-skills.mjs` walks `skills/` recursively and fails on missing `tier` frontmatter and >200-line files. 10 of 11 skills currently fail.
- Undiscoverable for routing — the lead consults `docs/routing-table.md` and the skill tier mental model; `3rdparty/` is invisible to both.

The user has chosen to **distribute** the skills into the existing tier taxonomy (rather than quarantine, rename, or fork into a separate tier).

## Goals

1. Eliminate the CI failure introduced by `skills/3rdparty/`.
2. Place all 11 third-party skills as first-class crew skills in `skills/{universal,workflow,domain,meta}/`, fully compliant with `validate-skills.mjs`.
3. Wire signals → skills in `docs/routing-table.md` so the lead can route to them.
4. Update crew agent prompts (`lead.md`, `builder.md`, `reviewer.md`, `validator.md`, `deployer.md`, `researcher.md`) with thin "consult skill X for signal Y" lines per the user-supplied role-to-skill mapping.
5. Add three new role stubs (`uxdesigner.md`, `architect.md`, `copywriter.md`) at `agents/` top level, each ≤300 lines with full crew frontmatter and Report contract.
6. Preserve drift visibility against upstream `aitmpl` by recording `source:` and `source_version:` in every distributed skill's frontmatter.
7. Keep CI green at every commit boundary.

## Non-goals

- Distributing the 21 third-party agents into top-level `agents/`. They remain in `agents/3rdparty/` for this slice; future promotion of selected agents is a separate decision.
- Forking or modifying the substantive content of upstream skills beyond what is needed to fit the ≤200-line cap, add frontmatter, and resolve naming collisions.
- Adding a new tier. The existing four tiers absorb all 11 skills with one semantic stretch (`domain/` hosts advisory packs).
- Building a `sync:upstream` script. Deferred until drift becomes painful.
- Editing `.claude-plugin/marketplace.json` packaging. The distributed skills will ship to consumers via the existing plugin packaging path; no exclusion.

## Distribution map

| # | Source path | Lines | Target tier | Target path | Action |
|---|---|---|---|---|---|
| 1 | `skills/3rdparty/brainstorming/` | 54 | universal | `skills/universal/brainstorming/` | move + frontmatter |
| 2 | `skills/3rdparty/code-reviewer/` | 209 | workflow | `skills/workflow/reviewing-code/` | rename dir + trim 10 lines + frontmatter |
| 3 | `skills/3rdparty/git-commit-helper/` | 209 | workflow | `skills/workflow/git-commit/` | trim 10 lines + frontmatter |
| 4 | `skills/3rdparty/systematic-debugging/` | 296 | workflow | `skills/workflow/systematic-debugging/` | real split: extract ~100 lines to `references/`, keep SKILL.md ≤200 |
| 5 | `skills/3rdparty/senior-architect/` | 209 | domain | `skills/domain/architecture-advisory/` | trim + frontmatter |
| 6 | `skills/3rdparty/senior-backend/` | 209 | domain | `skills/domain/backend-advisory/` | trim + frontmatter |
| 7 | `skills/3rdparty/senior-frontend/` | 209 | domain | `skills/domain/frontend-advisory/` | trim + frontmatter |
| 8 | `skills/3rdparty/senior-fullstack/` | 209 | domain | `skills/domain/fullstack-advisory/` | trim + frontmatter |
| 9 | `skills/3rdparty/senior-security/` | 209 | domain | `skills/domain/security-advisory/` | trim + frontmatter |
| 10 | `skills/3rdparty/senior-prompt-engineer/` | 226 | domain | `skills/domain/prompt-engineering/` | light split: ~30 lines to `references/examples.md` |
| 11 | `skills/3rdparty/skill-creator/` | 485 | meta | `skills/meta/skill-creator/` | major split: ~300 lines to existing `references/` files (already shipped) |

**Result:** 1 universal, 3 workflow, 6 domain, 1 meta. No empty cells, no new tier required.

### Naming-collision resolutions

| Upstream name | Crew first-party collision | Resolved name |
|---|---|---|
| `code-reviewer` (skill) | `agents/reviewer.md`, routing-table row 21 (`crew:reviewer` agent) | `skills/workflow/reviewing-code/` — `reviewing-code` (action gerund) vs `reviewer` (role) disambiguates skill from agent |
| `brainstorming` (skill) | `superpowers:brainstorming` (external plugin skill, not in this repo's skills/) | no collision — different plugin namespaces |
| `senior-architect` etc. | none — no first-party `senior-*` skills | direct map to `architecture-advisory`, `backend-advisory`, etc. for clarity |

## Frontmatter contract

Every distributed skill gets:

```yaml
---
name: <kebab-case, matches dir>
tier: universal | workflow | domain | meta
description: <one-line, used for skill discovery>
source: aitmpl/development/<original-upstream-name>
source_version: 2026-06-04          # date fetched via claude-code-templates
last_reviewed: 2026-06-04
owner: hero-crew
---
```

`source` + `source_version` are new optional fields — not enforced by `validate-skills.mjs` today. They are advisory: future drift audits can diff distributed `description:` / body against upstream by checking these.

## Split strategy

**Trim-in-place (8 skills, all at 209 lines):**
Shave to ≤200 by:
- Collapsing redundant headers.
- Compressing one example block per file.
- Removing decorative whitespace.

No semantic content lost. Preserves upstream narrative.

**Light split — `senior-prompt-engineer` (226 → ≤200):**
Move the longest example block (~30 lines) to `references/examples.md`. SKILL.md ends with a one-line pointer.

**Real split — `systematic-debugging` (296 → ≤200):**
This skill already ships with sibling files (`defense-in-depth.md`, `root-cause-tracing.md`, `condition-based-waiting.md`). Move long procedural sections from SKILL.md into the existing sibling files. SKILL.md becomes an index pointing to them.

**Major split — `skill-creator` (485 → ≤200):**
Already ships with `agents/`, `scripts/`, `eval-viewer/`, `references/` subdirs. Move bulk procedural content from SKILL.md into `references/` files (creating new ones if needed). SKILL.md becomes a thin entry-point with: purpose, when-to-use, pointers into refs.

Pattern matches `crew:terraform-ops-traps` (routing-table row 36).

## Routing-table additions

Add ~12 rows to `docs/routing-table.md` to wire signals → distributed skills, per the user's role-to-resource mapping. Signal-to-skill targets:

| Signal | Route to | Cite skill |
|---|---|---|
| Brainstorming / discovery before new feature | lead | `skills/universal/brainstorming/` |
| Diff under review (any code-bearing change) | reviewer | `skills/workflow/reviewing-code/` |
| Authoring a git commit message | builder | `skills/workflow/git-commit/` |
| Bug root cause / intermittent failure | validator or researcher | `skills/workflow/systematic-debugging/` |
| Architecture sketch / system design | new `architect.md` stub | `skills/domain/architecture-advisory/` |
| Backend code change | builder | `skills/domain/backend-advisory/` |
| Frontend code change | builder | `skills/domain/frontend-advisory/` |
| Full-stack change spanning both | builder | `skills/domain/fullstack-advisory/` |
| Security-sensitive change | reviewer (alongside gstack `/cso`) | `skills/domain/security-advisory/` |
| Prompt authoring (agent prompts, skill descriptions) | builder via `plugin-dev:agent-development` | `skills/domain/prompt-engineering/` |
| Authoring a new skill | builder via `plugin-dev:skill-development` | `skills/meta/skill-creator/` |
| UX / UI design | new `uxdesigner.md` stub | `skills/domain/frontend-advisory/` |

Existing rows are not modified beyond row 40 (security-sensitive) and row 27 (skill shape change) — both gain a co-citation pointer to the new distributed skill alongside the existing external-plugin skills.

## Crew agent prompt edits

For each of `agents/{lead,builder,reviewer,validator,deployer,researcher}.md`, add a single "Skills you consult" bullet block (3–8 lines max) citing the routing-table rows that apply to that role. Pattern:

```markdown
### Skills you consult (per routing-table)

- Code review on diff → `skills/workflow/reviewing-code/`
- Security-sensitive change → `skills/domain/security-advisory/`
- Bug root cause unclear → `skills/workflow/systematic-debugging/`
```

The bullet block follows the existing "External plugin skills as routed dependencies" pattern in `architecture.md` lines 41–51. No prompt rewrites. Total prompt growth ≤15 lines per agent. All six remain under the ≤300-line cap (`scripts/validate-agents.mjs`).

**Note:** `agents/lead.md` is tagged `autonomous_safe: false` per CLAUDE.md (any lead-prompt edit requires human-in-loop review). The edit is small and additive but still gates on user review.

## New role stubs

Three new agents at top-level `agents/`:

| File | Role | Delegates to (3rd-party subagents) | Cites (skills) |
|---|---|---|---|
| `agents/uxdesigner.md` | UX/UI design, frontend layout decisions | `agents/3rdparty/ui-ux-designer.md`, `agents/3rdparty/expert-react-frontend-engineer.md`, `agents/3rdparty/frontend-developer.md` | `skills/domain/frontend-advisory/`, `skills/universal/brainstorming/`, `skills/meta/skill-creator/` |
| `agents/architect.md` | System design, architecture sketches, ADR drafting | `agents/3rdparty/backend-architect.md`, `agents/3rdparty/database-architect.md`, `agents/3rdparty/cloud-architect.md`, `agents/3rdparty/api-architect.md`, `agents/3rdparty/diagram-architect.md` | `skills/domain/architecture-advisory/`, `skills/domain/security-advisory/`, `skills/domain/backend-advisory/`, `skills/domain/fullstack-advisory/`, `skills/universal/brainstorming/` |
| `agents/copywriter.md` | API docs, release notes, README polish, diagram captions | `agents/3rdparty/api-documenter.md`, `agents/3rdparty/diagram-architect.md`, `agents/3rdparty/markdown-syntax-formatter.md` | `skills/domain/architecture-advisory/`, `skills/domain/prompt-engineering/` |

Each stub:
- ≤300 lines (cap-compliant).
- Full frontmatter: `name`, `description`, `model: sonnet` (alias-form per existing crew convention; matches `docs/standards/model-selection.md` recommendation for spec-framed delegation work), `tools: [Read, Grep, Glob, Bash, Edit, Write, Agent]`.
- Includes the standard crew Report contract section.
- Identity: "I am the UXDesigner / Architect / Copywriter for this crew." Pattern mirrors existing `agents/researcher.md` shape.
- Delegation logic: thin — the stub frames the work, delegates the substantive task to one or more 3rd-party subagents via Agent tool, and synthesises the return into a single crew handoff artifact.

## Validator + CI strategy

`scripts/validate-skills.mjs` is **not** modified. Once distributed, all 11 skills satisfy the existing rules (frontmatter present, tier in enum, ≤200 lines, no dup, dir-name matches).

`scripts/validate-agents.mjs` is **not** modified. Top-level `agents/` will grow from 6 to 9 (`builder, deployer, lead, researcher, reviewer, validator, architect, copywriter, uxdesigner`). All 9 stay ≤300 lines.

**Stray-dup cleanup:** Before any move, delete `skills/3rdparty/.claude/skills/code-reviewer/` (leftover from install probe). This dup is what currently surfaces in validator output as "duplicate skill name".

**Cleanup of `skills/3rdparty/`:** After all 11 skills migrate out, `rm -rf skills/3rdparty/`. The `skills/3rd party.md` source-list file moves to `docs/operations/3rdparty-source-list.md` (preserves provenance record).

**Agents:** `agents/3rdparty/` stays intact, untouched. No move, no rename. CI continues to ignore it (current `validate-agents.mjs` only scans top-level).

## Architecture.md update

One paragraph added under "Skill tiers" → "Domain":

> The `domain/` tier hosts both stack-bound skills (e.g., `dotnet`, `flutter`) and **advisory packs** — subject-area discipline guides (`backend-advisory`, `security-advisory`, `prompt-engineering`, etc.) sourced from third-party authors. Advisory packs declare a `source:` + `source_version:` frontmatter pair for drift visibility against upstream.

No tier-enum change. No precedence-order change.

## Decomposition into FEATs and slices

**FEAT-A — CI unblock + skill distribution (largest slice).**
Single PR. Cannot be partial (validator goes red if `skills/3rdparty/` is partially emptied).
- Delete stray dup.
- Move + frontmatter all 11 skills to target tiers.
- Trim 8 × 209-line files; light split 1; real split 1; major split 1.
- Move `skills/3rd party.md` to `docs/operations/3rdparty-source-list.md`.
- `rm -rf skills/3rdparty/`.
- Update `docs/architecture/architecture.md` with advisory-pack paragraph.
- Run `node ./scripts/validate-skills.mjs` locally — must exit 0.

**FEAT-B — Routing-table additions.**
- Add ~12 rows to `docs/routing-table.md` per the table above.
- Run `node ./scripts/validate-routing-table.mjs` if such a check exists.

**FEAT-C — Crew agent prompt edits (autonomous_safe: false).**
- Add "Skills you consult" bullet block to 6 crew agents.
- Lead.md edit gates on human review per CLAUDE.md.

**FEAT-D — New role stubs.**
- Write `agents/uxdesigner.md`, `agents/architect.md`, `agents/copywriter.md`.
- Each ≤300 lines with full frontmatter + Report contract.
- Run `node ./scripts/validate-agents.mjs` — must exit 0.

**Sequencing:** A must land first (unblocks CI). B, C, D can land in any order after A. C is autonomous_safe: false so plan for human-in-loop on that slice.

## Risks and mitigations

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | Upstream drift — distributed skills diverge from `aitmpl` upstream; manual re-sync only via diff. | High | `source:` + `source_version:` frontmatter on every distributed skill. Quarterly drift audit added to `docs/operations/`. |
| 2 | Content damage from splitting — aggressive splits break narrative flow of upstream skill. | Med | Light trims first; reserve reference-extract for genuinely over-cap files. Manual eyeball each split before commit. |
| 3 | Naming collisions — `code-reviewer` already exists as `crew:reviewer` agent + appears in routing-table. | Med | Skill renamed to `reviewing-code`; agent stays `reviewer`. Document the disambiguation in routing-table notes. |
| 4 | `domain/` tier overload — 6 of 11 land in domain, doubling the existing domain count. | Low | Surface in architecture.md paragraph; revisit if confusion emerges. |
| 5 | `skill-creator` major split risks losing essential procedural content. | Med | Keep existing `agents/`, `scripts/`, `eval-viewer/` subdirs intact (they are already separate). Only split the SKILL.md body. Manual eyeball + lead approval before commit. |
| 6 | CI flips red on partial completion — distributing one skill at a time leaves others in `3rdparty/` failing validator. | Med | Bundle all 11 moves + dup-cleanup in FEAT-A. Single PR, single commit boundary. |
| 7 | First-party quality bar — distributed skills now subject to all 5 hard rules (frontmatter, dir-name match, no dup, ≤200, valid tier). Anything missed = CI red. | Med | Validate locally before commit. Add pre-commit hint to local docs. |
| 8 | Loss of vendored signal — once distributed, future devs may treat them as first-party authored. Drift detection harder. | Low | Mandatory `source:` frontmatter. Note in architecture.md. |
| 9 | Lead-prompt edit (FEAT-C) triggers `autonomous_safe: false` gate. | Low | Plan slice for human-in-loop review per CLAUDE.md. Surface in slice frontmatter. |
| 10 | Untracked `skills/3rd party.md` + `skills/agents-skils-comp.md` files predate this work; preserved or removed? | Low | Move `3rd party.md` → `docs/operations/3rdparty-source-list.md`. Leave `agents-skils-comp.md` for user to decide (out of scope here). |

## Open follow-ups (out of scope)

- Agent distribution — defer until specific 3rd-party agents earn first-party promotion (likely 3–5 of the 21 over time).
- `sync:upstream` script for periodic re-fetch + drift diff. Build when first painful.
- Optional `advisory/` tier if `domain/` overload becomes a real semantic problem.

## Acceptance criteria

1. `node ./scripts/validate-skills.mjs` exits 0.
2. `node ./scripts/validate-agents.mjs` exits 0.
3. `npm test` exits 0.
4. `git status` shows no `skills/3rdparty/` directory.
5. All 11 distributed skills have `source:` + `source_version:` frontmatter.
6. `docs/routing-table.md` cites at least one distributed skill in at least 8 of the 12 planned signal rows.
7. Three new role stubs exist at top-level `agents/` with valid frontmatter + Report contract.
8. `docs/architecture/architecture.md` contains the advisory-pack paragraph under "Skill tiers" → "Domain".
