---
title: Extract substantive guidance from agents/3rdparty/ into skills/
date: 2026-06-04
status: draft
authors: [lead]
related:
  - docs/superpowers/specs/2026-06-04-3rdparty-distribute-design.md
---

# Extract substantive guidance from `agents/3rdparty/` into `skills/`

## Problem

The 21 vendored agents under `agents/3rdparty/` (committed `5ea93fd`) contain substantive technical guidance — anti-patterns, framework specifics, decision rules — that crew agents currently cannot consult inline. Per `docs/architecture/architecture.md`:

> No specialist builders (csharpbuilder etc.). Specializations are skills.

Specialist content belongs in `skills/`, not vendored as parallel agents. This spec extracts the high-yield content from 12 of those 21 agents into first-class skills and wires them into the crew via `docs/routing-table.md` + agent prompt "Skills you consult" blocks.

## Goals

1. Convert specialist-builder content (`python-pro`, `typescript-pro`, `ai-engineer`) into `skills/domain/*` per the "specializations are skills" rule.
2. Extract high-value Track 1 overlap content (`devops-engineer`, `research-coordinator`, `database-architect`, `cloud-architect`, `ui-ux-designer`, `expert-react-frontend-engineer`, `api-documenter`, `diagram-architect`) into discoverable skills.
3. Augment `skills/workflow/reviewing-code/` with language-specific checklists drawn from `agents/3rdparty/code-reviewer.md`.
4. Wire all new skills via `docs/routing-table.md` (≈15 new rows).
5. Update agent "Skills you consult" blocks for builder, reviewer, validator, deployer, researcher, architect, uxdesigner, copywriter.
6. Preserve drift visibility via `source:` + `source_version:` frontmatter on every new skill.
7. Keep CI green at every commit boundary.

## Non-goals

- Distributing thin agents (<100 lines with no substantive content beyond identity/tools): backend-architect (51), api-architect (109), markdown-syntax-formatter (56). Deferred.
- Extracting `c-sharp-pro` (38 lines, mostly identity) — too thin, defer until C# work picks up.
- Extracting `frontend-developer` (255 lines) as a standalone skill — content overlaps with `expert-react-frontend-engineer`; merge into the react skill.
- Folding `devops-troubleshooter` (32 lines) into its own skill — content folds into `devops-engineering` skill as a subsection.
- Touching agent prompts in `agents/3rdparty/`. They remain reference-only.
- Renaming or moving `agents/3rdparty/` — separate decision.
- Adding sub-subdirs under `skills/domain/`. Keep flat for now.

## Decomposition (5 slices)

### Slice 1 — Track 2: language-pro skills

Target skills:
- `skills/domain/python-pro/` (source: `agents/3rdparty/python-pro.md`, 256 lines)
- `skills/domain/typescript-pro/` (source: `agents/3rdparty/typescript-pro.md`, 275 lines)
- `skills/domain/ai-engineering/` (source: `agents/3rdparty/ai-engineer.md`, 285 lines)

Routing-table additions:
- `*.py` file edit → builder → cite `skills/domain/python-pro/`
- `*.ts` / `*.tsx` file edit → builder → cite `skills/domain/typescript-pro/`
- AI app code (Anthropic / OpenAI SDK imports, prompt engineering, agent frameworks) → builder → cite `skills/domain/ai-engineering/` + existing `skills/domain/prompt-engineering/`

Agent prompt updates: `agents/builder.md` "Skills you consult" block gains 3 bullets.

**Effort: 3–5h. 1 FEAT, 1 PR.**

### Slice 2 — Track 1: devops + research skills

Target skills:
- `skills/domain/devops-engineering/` (source: `agents/3rdparty/devops-engineer.md`, 884 lines → major split using `references/`)
- `skills/workflow/research-coordination/` (source: `agents/3rdparty/research-coordinator.md`, 93 lines → light extract)

`devops-troubleshooter` (32 lines) folds into `devops-engineering/references/troubleshooting.md` rather than a standalone skill.

Routing-table additions:
- CI/CD pipeline change → deployer → cite `skills/domain/devops-engineering/`
- IaC change (terraform, bicep, helm) → deployer + builder → co-cite alongside existing `crew:terraform-ops-traps` row
- Incident response / production troubleshooting → deployer + validator → cite `skills/domain/devops-engineering/` + `references/troubleshooting.md`
- Multi-source research / synthesis from disparate sources → researcher → cite `skills/workflow/research-coordination/`

Agent prompt updates: `agents/deployer.md` + `agents/researcher.md` + `agents/validator.md` "Skills you consult" blocks.

**Effort: 3–4h.**

### Slice 3 — Track 1: architecture extensions

Target skills:
- `skills/domain/database-architecture/` (source: `agents/3rdparty/database-architect.md`, 682 lines → major split)
- `skills/domain/cloud-architecture/` (source: `agents/3rdparty/cloud-architect.md`, 275 lines)

Cross-reference `skills/domain/architecture-advisory/` (existing from FEAT-A) → cite the two new skills for db/cloud sub-topics.

Routing-table additions:
- Schema design / migration / database performance → architect / builder → cite `skills/domain/database-architecture/`
- Cloud infra design (multi-region, IAM, network topology) → architect / deployer → cite `skills/domain/cloud-architecture/`

Agent prompt updates: `agents/architect.md` "Skills you consult" block extends.

**Effort: 2–3h.**

### Slice 4 — Track 1: UX + frontend + docs extensions

Target skills:
- `skills/domain/ux-methodology/` (source: `agents/3rdparty/ui-ux-designer.md`, 471 lines → major split)
- `skills/domain/react-engineering/` (source: `agents/3rdparty/expert-react-frontend-engineer.md`, 739 lines → major split; merge `frontend-developer.md` content)
- `skills/workflow/api-documentation/` (source: `agents/3rdparty/api-documenter.md`, 275 lines)
- `skills/domain/diagram-methodology/` (source: `agents/3rdparty/diagram-architect.md`, 137 lines → light extract)

Routing-table additions:
- UX research / user-flow design → uxdesigner → cite `skills/domain/ux-methodology/`
- React-specific code (hooks, state management, suspense) → builder → cite `skills/domain/react-engineering/`
- API documentation authoring → copywriter → cite `skills/workflow/api-documentation/`
- Diagram authoring (architecture, flow, sequence) → copywriter / architect → cite `skills/domain/diagram-methodology/`

Agent prompt updates: `agents/uxdesigner.md` + `agents/copywriter.md` + `agents/builder.md` "Skills you consult" blocks.

**Effort: 3–5h.**

### Slice 5 — reviewing-code skill augmentation

Augment existing `skills/workflow/reviewing-code/` with language-specific checklists drawn from `agents/3rdparty/code-reviewer.md` (175 lines). Specifically: Python / TypeScript / JavaScript / Swift / Kotlin / Go review checklists currently in the agent body but not in the skill.

If augmentation would push SKILL.md over 200 lines, extract per-language checklists to `skills/workflow/reviewing-code/references/<lang>-checklist.md`.

No new routing-table rows; existing reviewing-code rows still apply.

Agent prompt updates: none required — `agents/reviewer.md` already cites `skills/workflow/reviewing-code/`.

**Effort: 1–2h.**

## Extraction template (applies to all slices)

For each source agent, the builder follows this template:

```
SOURCE: agents/3rdparty/<name>.md (<N> lines)
TARGET: skills/<tier>/<name>/SKILL.md (must be ≤200 lines)

DROP:
- YAML frontmatter (rewrite from scratch for skill schema)
- Identity intro ("I am the X agent...")
- Tool allowlist
- Report contract section
- Agent-only metadata (model: opus/sonnet, etc.)

KEEP:
- Technical guidance and patterns
- Checklists and decision rules
- Anti-patterns and pitfalls
- Framework-specific guidance
- Example sequences (compress, don't fragment)

TRANSFORM:
- Imperative agent voice ("I check X") → procedural voice ("Check X")
- Section ordering aligned with skill conventions

WHEN SKILL.md WOULD EXCEED 200 LINES:
- Default to reference-extract: move long sections to skills/<tier>/<name>/references/<topic>.md
- Each references/*.md must be self-contained (no "context in SKILL.md required")
- SKILL.md becomes a thin index citing refs by purpose (not page number)
- Mirror systematic-debugging + skill-creator + terraform-ops-traps pattern

REDUCTION LIMIT:
- Any single SKILL.md reduction >60% vs upstream substantive content requires explicit reference-extract instead of trim
- Builder reports per-file reduction in completion artifact
```

## Frontmatter contract (new skills)

```yaml
---
name: <kebab matches dir>
tier: universal | workflow | domain | meta
description: <one-line, used for skill discovery>
source: aitmpl/<category>/<original-upstream-name>
source_version: 2026-06-04
last_reviewed: 2026-06-04
owner: hero-crew
triggers: [file-glob-or-keyword, ...]   # recommended, helps the 28-warning backlog
---
```

## Acceptance criteria (overall, all slices)

1. `node ./scripts/validate-skills.mjs` exits 0 after every slice.
2. `node ./scripts/validate-agents.mjs` exits 0 after every slice.
3. `npm test` exits 0 after every slice.
4. Every new skill has `source:` + `source_version:` frontmatter.
5. Every new SKILL.md ≤200 lines.
6. Every new skill has `triggers:` array + "When to use" + "Done / Acceptance" section headings (closes the 28-warning advisory backlog for new skills).
7. `docs/routing-table.md` cites every new skill in at least one signal row.
8. No single SKILL.md is >60% smaller than the substantive content of its upstream agent source without explicit reference-extract.
9. Agent prompt edits keep all 9 `agents/*.md` files ≤300 lines.

## Risk mitigations (folded from prior brainstorm)

| Risk | Mitigation |
|---|---|
| Content damage from splits | Extraction template above + reference-extract default + per-file reduction limit + reviewer pass per slice |
| `skills/domain/` directory bloat (7 → ~15 dirs) | Defer sub-subdirs; revisit if scan-ability suffers |
| Routing-table growth (57 → ~72 rows) | Existing pattern handles 45+ rows; add H3 category groupings if helpful |
| Style mismatch (agent vs skill) | Extraction template explicit DROP/KEEP/TRANSFORM rules |
| Builder aggressive trim (FEAT-A precedent: skill-creator 485→109) | Reduction limit + reference-extract default + per-slice reviewer dispatch |
| Trim discipline drift across slices | Each slice's builder dispatch includes the extraction template inline |
| Untracked WIP collision risk | `skills/agents-skils-comp.md` (pre-session typo) untouched; left for user disposition |

## Slice sequencing

- Slice 1 first: smaller scope, proves the extraction template against language-pro content.
- Slice 5 last: builds on the reviewing-code pattern; cheapest if Slice 1–4 surface refinements.
- Slices 2–4 ordered by content yield (devops/research first because devops-engineer is the largest single yield).

After each slice: validate, commit, optionally push, then proceed.

## Out of scope (deferred follow-ups)

- Sub-subdirs under `skills/domain/` (`languages/`, `infra/`, `frontend/`) — revisit after dir reaches ~15 entries.
- Promote remaining thin 3rd-party agents (backend-architect, api-architect, markdown-syntax-formatter, c-sharp-pro, devops-troubleshooter standalone) — defer.
- Polish slice for the 28 advisory warnings on FEAT-A skills (triggers:, section headings) — separate slice.
- `npm run sync:upstream` script for upstream drift detection — defer until first drift becomes painful.
- Rename or move `agents/3rdparty/` — separate decision after extraction completes.
