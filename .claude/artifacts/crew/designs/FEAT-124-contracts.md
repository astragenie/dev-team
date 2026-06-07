---
feat: FEAT-124
title: Consolidate crew:copywriter → loop:document-writer
date: 2026-06-07
status: draft
scope: cross-repo agent-prompt consolidation (hero-crew + loop)
---

# FEAT-124 — Contract Artifact

Scope: a cross-repo consolidation of two overlapping documentation-writer
agent prompts. Most contract sections do not apply because no runtime
interfaces, APIs, events, or persisted data shapes change. The load-bearing
contract is the **agent dispatch surface** — `subagent_type` strings used by
callers — and the **routing-table row schema** that maps work signals to
those subagent identifiers.

## TypeScript Interfaces

N/A — agent prompt consolidation, no runtime contracts.

## API Contracts

N/A — agent prompt consolidation, no runtime contracts.

## Event Schemas

N/A — agent prompt consolidation, no runtime contracts.

## Data Contracts

### 1. Agent dispatch surface (subagent_type string)

The only contract that crosses an agent boundary is the dispatch identifier
used by the caller when invoking the Agent tool. Today both
`crew:copywriter` and `loop:document-writer` are valid dispatch targets and
have overlapping triggering descriptions. FEAT-124 collapses to one.

#### Current state (pre-FEAT-124)

Two parallel dispatch surfaces, both reachable:

```yaml
# crew:copywriter (hero-crew)
file: C:\work\mega\hero-crew\agents\copywriter.md
frontmatter:
  name: copywriter            # dispatched as `crew:copywriter` from external callers
  description: |
    Technical writing specialist for API documentation, release notes,
    README polish, diagram captions, and developer-facing content.
    Use when a task requires structured technical prose, OpenAPI doc
    generation, changelog drafting, or documentation review.
  model: sonnet
  effort: medium
  maxTurns: 25
  tools: [Read, Grep, Glob, Bash, Edit, Write, Agent]
  color: cyan

# loop:document-writer (loop)
file: C:\work\mega\loop\agents\document-writer.md
frontmatter:
  name: document-writer       # dispatched as `loop:document-writer`
  description: |
    Documentation specialist for README, CHANGELOG, ADRs, retrospectives,
    SPEC bodies, agent/skill prompts, and release notes. Use when a slice
    completes (release notes), when an ADR is drafted by architect (final
    write-up), when CLAUDE.md drifts from reality, or when a SPEC body
    needs filling in. Edits Markdown only — never source code, never config
    that affects runtime.
  color: yellow
  tools: [Read, Edit, Write, Grep, Glob]   # NB: no Bash, no Agent
```

Active dispatch callsites for `crew:copywriter` in hero-crew:

| Callsite                                              | Caller intent                |
|------------------------------------------------------|------------------------------|
| `commands/orchestrate-slice.md:392` (Step 6)         | CHANGELOG entry drafting     |
| `commands/orchestrate-slice.md:410` (Step 7, fallback) | Release-notes drafting     |

No skill, agent prompt, or hook in either repo dispatches `crew:copywriter`
beyond these two lines. Loop never dispatches it; loop only *allowlists* it
in `hooks/guard-feat-dispatch.mjs` and references it as a `MODEL_PHASES`
key.

#### Target state (post-FEAT-124)

Single dispatch surface:

```yaml
# loop:document-writer (loop) — scope-extended
file: C:\work\mega\loop\agents\document-writer.md
frontmatter:
  name: document-writer
  description: |
    Documentation specialist for README, CHANGELOG, ADRs, retrospectives,
    SPEC bodies, agent/skill prompts, release notes, API reference
    documentation (OpenAPI specs, SDK reference, integration guides,
    error docs, versioning, deprecation notices), and diagram captions
    / architecture narrative / Mermaid prose. Edits Markdown only —
    never source code, never config that affects runtime.
  color: yellow
  tools: [Read, Edit, Write, Grep, Glob]
```

All callers dispatch `loop:document-writer`. The hero-crew `copywriter.md`
file remains on disk during the deprecation window with a deprecation
banner and re-route note (see Migration shim below) but is no longer
dispatched by any in-repo caller.

#### Capability delta absorbed by `loop:document-writer`

| Capability                                  | Source (today)        | Target (loop:document-writer extension) |
|---------------------------------------------|-----------------------|------------------------------------------|
| API reference / OpenAPI prose               | crew:copywriter       | Add to scope; promote `agents/3rdparty/api-documenter.md` to primary dispatch for OpenAPI work |
| Diagram captions / Mermaid prose            | crew:copywriter       | Add to scope; keep `agents/3rdparty/diagram-architect.md` dispatch |
| Markdown structural cleanup                 | crew:copywriter       | Already implicit; keep `agents/3rdparty/markdown-syntax-formatter.md` dispatch |
| `skills/workflow/api-documentation/` consult | crew:copywriter      | Add to consult-skills list |
| `skills/domain/diagram-methodology/` consult | crew:copywriter      | Add to consult-skills list |
| `skills/domain/backend-advisory/` consult   | crew:copywriter       | Add to consult-skills list |
| `skills/domain/architecture-advisory/` consult | crew:copywriter    | Add to consult-skills list |
| Custom-instructions cascade override        | crew:copywriter       | Optional: add `~/.claude/loop/document-writer.md` cascade |
| `Bash` + `Agent` tools                      | crew:copywriter       | **Not absorbed** — preserve loop:document-writer's Markdown-only boundary; sub-agent dispatches happen via the existing 3rdparty pattern without adding `Bash` |

The deliberate non-absorption of `Bash` + `Agent` is the most important
contract-level decision: it preserves `loop:document-writer`'s hard
Markdown-only filetype boundary and its five anti-hallucination rules,
which are not present in `crew:copywriter`. Dispatch to 3rdparty
specialists happens through the Agent tool, which is added to the loop
prompt's allowed tools as part of this scope-extension (and is the one
necessary tool addition).

### 2. Migration shim contract — `crew:copywriter` during deprecation

Goal: any external workflow that still types `crew:copywriter` in a
subagent_type string keeps working for one release cycle without silent
failure.

Shim shape (hero-crew `agents/copywriter.md` after this FEAT):

```yaml
---
name: copywriter
description: |
  [DEPRECATED — use loop:document-writer]
  Technical writing specialist for API documentation, release notes,
  README polish, diagram captions, and developer-facing content.
  This agent is retained for one release cycle for backward compatibility;
  new dispatches should target loop:document-writer.
model: sonnet
effort: medium
maxTurns: 25
tools: [Read, Grep, Glob, Bash, Edit, Write, Agent]
color: cyan
---

# DEPRECATED — use loop:document-writer

This agent is deprecated as of hero-crew v0.20.0 (FEAT-124). The
documentation-writer scope has consolidated into `loop:document-writer`.

**Migration**: Replace any `subagent_type: crew:copywriter` with
`subagent_type: loop:document-writer`. The loop agent now covers:
API reference docs, release notes, README, diagram captions,
architecture narrative, ADRs, SPEC bodies.

**Removal target**: hero-crew v0.21.0 (next minor bump). After removal,
dispatches to `crew:copywriter` will fail with subagent-not-found.

[remainder of original prompt body preserved verbatim so any caller that
still routes here gets functional behavior during the deprecation window]
```

Resolution contract during the shim window:

| Caller writes                          | Resolves to                          | Behavior                                  |
|---------------------------------------|--------------------------------------|-------------------------------------------|
| `subagent_type: crew:copywriter`      | hero-crew `agents/copywriter.md`     | Functional; emits deprecation banner in response headline; uses original prompt body |
| `subagent_type: loop:document-writer` | loop `agents/document-writer.md`     | Functional; canonical path                |
| `subagent_type: copywriter` (bare)    | resolved by Claude Code's plugin namespace rules; ambiguous | Discourage; document as not-supported in CHANGELOG |

No automatic redirect at the harness level — the shim is a documentation
banner inside the prompt, not a dispatch rewrite. This avoids invisible
behavior changes during the deprecation window.

### 3. Routing-table row schema for the merged surface

`docs/routing-table.md` rows that today reference `copywriter` move to
`loop:document-writer`. The row shape (Signal / Route to / Notes triple)
is unchanged; only the destination string changes.

#### Diff against current routing table

Section **Docs & comms** (`docs/routing-table.md:107-108`):

```diff
- | **API documentation authoring** (OpenAPI specs, SDK reference guides, integration guides, error documentation, versioning, deprecation notices) | copywriter | Load `skills/workflow/api-documentation/`. Co-cite `skills/domain/backend-advisory/` for API design concerns. |
+ | **API documentation authoring** (OpenAPI specs, SDK reference guides, integration guides, error documentation, versioning, deprecation notices) | `loop:document-writer` | Load `skills/workflow/api-documentation/`. Co-cite `skills/domain/backend-advisory/` for API design concerns. |

- | **Diagram authoring** (architecture diagrams, flowcharts, sequence diagrams, ERDs, state machines, dependency graphs, Mermaid / PlantUML / Draw.io) | copywriter / architect | Load `skills/domain/diagram-methodology/`. Architect uses for ADR diagrams; copywriter uses for docs-embedded diagrams. |
+ | **Diagram authoring** (architecture diagrams, flowcharts, sequence diagrams, ERDs, state machines, dependency graphs, Mermaid / PlantUML / Draw.io) | `loop:document-writer` / architect | Load `skills/domain/diagram-methodology/`. Architect uses for ADR diagrams; `loop:document-writer` uses for docs-embedded diagrams. |
```

Section **Crew internals** (`docs/routing-table.md:130`):

```diff
- | **Lead-prompt edit or specialist-agent prompt edit** (any change to `agents/{lead,architect,uxdesigner,copywriter}.md`) | builder + human-in-loop review | All four are `autonomous_safe: false` — changes require human-in-loop review before merging. See `docs/governance.md` autonomous_safe policy section. |
+ | **Lead-prompt edit or specialist-agent prompt edit** (any change to `agents/{lead,architect,uxdesigner}.md`) | builder + human-in-loop review | All three are `autonomous_safe: false` — changes require human-in-loop review before merging. See `docs/governance.md` autonomous_safe policy section. |
```

Row count unchanged (no rows added or removed). Cell content changes only.

#### Command-dispatch diff

`commands/orchestrate-slice.md` Steps 6 and 7 update from `crew:copywriter`
to `loop:document-writer`. Step 7's pre-existing fallback chain (`if
loop:document-writer available, dispatch it. Otherwise crew:copywriter`)
becomes a single direct dispatch to `loop:document-writer` with no
fallback — the shim handles the case where a custom workflow somewhere
still types the old name.

## Design notes

### Deprecation strategy

**Shim period: one release cycle.**

- hero-crew v0.20.0 ships the deprecation banner + re-route note in
  `agents/copywriter.md`; all in-repo callsites move to
  `loop:document-writer`.
- hero-crew v0.21.0 removes the `copywriter.md` file (the next minor
  bump). The CHANGELOG entry in v0.20.0 must announce v0.21.0 as the
  removal target so users have time to migrate.
- Loop-side: keep `crew:copywriter` in `hooks/guard-feat-dispatch.mjs`
  allowlist + error-message text + `src/scripts/lib/model-router.mts`
  `MODEL_PHASES` + `.claude/loop.json` `modelRouting` for the same
  deprecation window. Remove in a follow-up FEAT after the hero-crew
  v0.21.0 cut.

Rationale for one cycle (not immediate hard cut): only two in-tree
callsites depend on the name, but the FEAT-124 risks section explicitly
calls out "users with `crew:copywriter` in custom workflows need
migration notice". A one-release shim with a banner in the prompt body
gives those users a noisy-but-functional path; a hard cut breaks them
silently.

Alternative considered: **immediate hard cut**. Defensible because only
2 in-tree callsites need updating and the shim adds maintenance burden
across two repos for an unknown number of external consumers. Recommend
asking the user before authoring the slice — the research findings
explicitly flagged this as a decision worth surfacing.

### Scope-bump items needed on loop side

The `loop:document-writer` prompt extension is the load-bearing change
on the loop side. Concrete edits:

1. `agents/document-writer.md` — extend `description:` per the target
   shape above (adds API docs + diagram captions explicitly).
2. Add `Agent` to `tools:` so sub-agent dispatch (api-documenter,
   diagram-architect, markdown-syntax-formatter) is possible. Do **not**
   add `Bash` — preserve the Markdown-only boundary.
3. Add four consult-skills rows to the "Skills you consult" section:
   - `skills/workflow/api-documentation/` (OpenAPI / SDK guides)
   - `skills/domain/diagram-methodology/` (Mermaid / PlantUML / ERD)
   - `skills/domain/backend-advisory/` (API design concerns)
   - `skills/domain/architecture-advisory/` (architecture narrative)
4. Add three 3rdparty delegation-map rows:
   - API reference / OpenAPI → `agents/3rdparty/api-documenter.md`
   - Diagram captions / Mermaid prose → `agents/3rdparty/diagram-architect.md`
   - Markdown structural cleanup → `agents/3rdparty/markdown-syntax-formatter.md`
5. (Optional, per research findings) Add custom-instructions cascade
   block referencing `~/.claude/loop/document-writer.md` if loop adopts
   the cascade pattern; otherwise document the absence as an explicit
   non-feature.
6. Narrative-only edits with no behavior change:
   - `src/scripts/lib/slice-linker/dispatch.mts:119` — drop `copywriter`
     from the dispatch error-message enumeration.
   - `hooks/guard-feat-dispatch.mjs:15` — update comment narrative.
7. CHANGELOG.md entry under loop `v0.29.0` with `### Added` (extended
   scope) and `### Deprecation` (announce `crew:copywriter` removal in
   the corresponding hero-crew minor).

### Risk — users with `crew:copywriter` in private workflows

The FEAT explicitly flags this risk. Mitigations the shim contract
provides:

- Deprecation banner inside the prompt body is visible in the agent's
  first response (the prompt instructs an opening "DEPRECATED" line).
- One-release window between announcement (v0.20.0) and removal
  (v0.21.0) gives time to migrate.
- CHANGELOG entry in both repos under the corresponding versions
  cross-references the new dispatch identifier and the removal target.

Unmitigated residual risk: consumers who have pinned a hero-crew version
and do not read the CHANGELOG before upgrading to v0.21.0 will see a
silent dispatch failure (subagent-not-found). The recommended mitigation
is a hero-crew v0.21.0 CHANGELOG entry under a `### Breaking` heading
plus a routing-table comment row that records the prior identifier for
six months. Out of scope for this FEAT but flagged for the v0.21.0 slice.

### Sequencing — hero-crew patch first OR loop minor first?

**Recommendation: loop v0.29.0 first, then hero-crew v0.20.0.**

Reason: hero-crew v0.20.0's `docs/routing-table.md` rows will point
"API documentation authoring" + "Diagram authoring" at
`loop:document-writer`. If hero-crew ships first, the routing table
points at an under-scoped agent for the window between the two
releases — a user dispatching per the routing table during that window
gets a `loop:document-writer` that still reads as
"Documentation specialist for README, CHANGELOG, ADRs, retrospectives,
SPEC bodies, agent/skill prompts, and release notes" without API-docs
or diagram-caption coverage in its `description:`. The triggering
description is the dispatch contract, so this is observable.

Conversely if loop ships first, the worst case during the gap is that
`loop:document-writer` has scope it isn't yet routed to — overinclusive
description with no caller mismatch. That's the safer asymmetry.

Versioning per the research findings:
- **Loop v0.29.0** — `### Added: extend document-writer scope to cover
  API docs + diagram captions (FEAT-124)`; `### Deprecation: crew:copywriter
  will be removed in hero-crew v0.21.0`.
- **Hero-crew v0.20.0** — re-route + deprecation banner + command
  callsite updates. Minor bump (not patch) because dispatch identifiers
  in `commands/orchestrate-slice.md` change, which is a behavior change
  for any caller chaining through the orchestrate-slice command.

FEAT-124's existing acceptance criterion says "hero-crew patch bump +
loop minor bump". The research finding contradicts the patch
classification and recommends hero-crew **minor** v0.20.0 instead. Flag
this as an open trade-off — user to confirm before slice authoring.

## Inferred Tags

The FEAT's current frontmatter declares:

```yaml
tags: ["surface:agents", "concern:dx", "concern:naming"]
```

None of these values appear in `docs/standards/feat-tag-schema.md` v1.0.0
enums. The schema-valid replacement set, with rationale per the schema's
producer-contract heuristic:

```yaml
tags:
  - stack:none           # FEAT is pure docs / agent-prompt / routing-table work; no language code changes
  - surface:docs         # Visible artifact category is agent-prompt markdown + routing-table markdown + CHANGELOG entries
  - concern:governance   # The driver is routing-table policy + agent-prompt policy (autonomous_safe enumeration) consolidation
```

Notes on the mapping:

- **`stack:none` over `stack:typescript`**: the loop-side narrative edits
  to `src/scripts/lib/slice-linker/dispatch.mts:119` and
  `hooks/guard-feat-dispatch.mjs:15` are comment / error-message string
  updates with zero behavior change. They don't tip the FEAT into
  `stack:typescript` territory under the schema's "language code changed"
  heuristic.
- **`surface:docs` over `surface:schema`**: the routing-table is prose +
  table rows, not a YAML/JSON contract schema. The agent-prompt
  frontmatter is YAML but the load-bearing edit is the prose
  `description:` field; the frontmatter schema itself is unchanged.
- **`concern:governance` over `concern:refactor`**: routing-table
  policy + autonomous_safe-agent enumeration + cross-repo dispatch
  contract are governance artifacts in the schema's
  "policy / gate / governance / enforcement" cluster. The work is
  refactoring-adjacent, but the policy dimension is the dominant driver.

Recommended action on the FEAT file itself: update the `tags:` array in
`docs/backlog/triaged/FEAT-124.md` frontmatter to the schema-valid
values above. Out of scope for this contract artifact; flagged for the
slice that picks up FEAT-124.

---

## Revisions

_None — initial draft 2026-06-07._
