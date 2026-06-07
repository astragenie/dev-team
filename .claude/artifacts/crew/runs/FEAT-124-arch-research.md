# FEAT-124 — research findings (crew:copywriter → loop:document-writer consolidation)

**FEAT file**: `docs/backlog/triaged/FEAT-124.md`
**Date**: 2026-06-07
**Scope**: read-only research; map the consolidation surface across hero-crew and loop.

---

## 1. `crew:copywriter` — current shape (hero-crew)

**File**: `C:\work\mega\hero-crew\agents\copywriter.md` — 114 lines.

**Frontmatter**:
- `name: copywriter`
- `description`: "Technical writing specialist for API documentation, release notes, README polish, diagram captions, and developer-facing content. Use when a task requires structured technical prose, OpenAPI doc generation, changelog drafting, or documentation review."
- `model: sonnet`, `effort: medium`, `maxTurns: 25`
- `tools: [Read, Grep, Glob, Bash, Edit, Write, Agent]`
- `color: cyan`

**Sections**: custom-instructions cascade; Scope (owns/doesn't); 5 consult-skills; 3rd-party delegation map; 5 operating rules; report contract via `write-handoff`; handoff-before-stop; context-efficiency rules.

**Owns** (lines 27–32): API reference (OpenAPI, README endpoints); release notes and changelogs; README / getting-started; diagram captions and architecture narrative; dev-facing inline comments / doc-strings.

**Skills referenced**:
- `skills/domain/architecture-advisory/` (narrative)
- `skills/workflow/api-documentation/` (OpenAPI / SDK guides)
- `skills/domain/diagram-methodology/` (Mermaid/PlantUML/ERD)
- `skills/domain/prompt-engineering/` (prompt/skill description)
- `skills/domain/backend-advisory/` (API design concerns)

**Sub-agents it dispatches**:
- `agents/3rdparty/api-documenter.md` — OpenAPI / endpoint docs
- `agents/3rdparty/diagram-architect.md` — diagram captions / Mermaid prose
- `agents/3rdparty/markdown-syntax-formatter.md` — Markdown structure cleanup

**Unique vs `loop:document-writer`**:
- Has `Bash` + `Agent` tools (loop docwriter is Markdown-only: Read/Edit/Write/Grep/Glob).
- Cites `skills/workflow/api-documentation/` (OpenAPI focus) — loop docwriter cites `api-documenter` only as "analogue".
- Cites `skills/domain/architecture-advisory/` and `skills/domain/backend-advisory/` — no loop equivalent.
- Custom-instructions cascade `~/.claude/crew/copywriter.md` — no loop equivalent.
- Uses `crew.ts write-handoff` for report contract.

---

## 2. `loop:document-writer` — current shape (loop)

**File**: `C:\work\mega\loop\agents\document-writer.md` — 79 lines.

**Frontmatter**:
- `name: document-writer`
- `description`: "Documentation specialist for README, CHANGELOG, ADRs, retrospectives, SPEC bodies, agent/skill prompts, and release notes. Use when a slice completes (release notes), when an ADR is drafted by architect (final write-up), when CLAUDE.md drifts from reality, or when a SPEC body needs filling in. Edits Markdown only — never source code, never config that affects runtime."
- `color: yellow`
- `tools: [Read, Edit, Write, Grep, Glob]` (no Bash, no Agent)
- No `model:` / `effort:` / `maxTurns:`

**Sections**: Output contract (file list + diffs + rationale + summary table); 7 context-gathering rules; Required skill (`loop:loop-discipline`); 3 consult-skills; 3 sub-agents; 5 anti-hallucination rules; hard Markdown-only boundary; "if asked to write code, redirect to crew:builder".

**Unique vs `crew:copywriter`**:
- Hard Markdown-only filetype boundary (`*.md`, `*.mdx`, `*.MD`; CHANGELOG/README/CLAUDE.md exceptions). Never `*.mjs`, `*.json`, `*.yml`, `*.toml`, lockfiles, scripts.
- 5 explicit anti-hallucination rules (copywriter has 1 implicit).
- Required skill block (`loop:loop-discipline`).
- Output summary table format.
- Pulls from `.claude/artifacts/loop/loop-snapshot.md` and `.claude/artifacts/loop/backlog/done/`.

**Scope gap to absorb from copywriter**:
- API reference documentation (OpenAPI specs, SDK reference guides, integration guides, error docs, versioning, deprecation notices).
- Diagram captions / Mermaid prose (currently sub-agent only, not primary scope).
- Custom-instructions cascade override path.

---

## 3. `crew:copywriter` references in hero-crew

### `agents/*.md`
None.

### `commands/**/*.md`
- `commands/orchestrate-slice.md:392` — Step 6 dispatches `crew:copywriter` (CHANGELOG entry).
- `commands/orchestrate-slice.md:410` — Step 7 fallback: "If `loop:document-writer` available, dispatch it. Otherwise `crew:copywriter`."

### `skills/**/SKILL.md`
None.

### `docs/**/*.md`
- `docs/routing-table.md:107` — "API documentation authoring" → `copywriter`.
- `docs/routing-table.md:108` — "Diagram authoring" → `copywriter / architect`.
- `docs/routing-table.md:130` — "Lead-prompt edit or specialist-agent prompt edit" mentions `agents/{lead,architect,uxdesigner,copywriter}.md` (autonomous_safe gate).
- `docs/backlog/triaged/FEAT-124.md` — the FEAT itself.
- `docs/backlog/triaged/FEAT-123.md:55,67` — diagram POC already routes through `loop:document-writer` (related work).
- `docs/backlog/done/FEAT-040.md:37,38` — historical orchestrate-slice spec.
- `docs/superpowers/plans/2026-06-05-orchestrate-slice-command.md:410,426` — historical plan doc.

### CHANGELOG
- `CHANGELOG.md:319,320` — narrative for orchestrate-slice Step 6 / Step 7.

### `.claude/artifacts/` (historical, do not edit)
- Reviewer handoff `20260605T062722Z-...` flagged copywriter "does not exist" (long resolved).
- Final-synthesis + review-result reference name in past summaries.

### `loop:document-writer` references already in hero-crew
- `commands/orchestrate-slice.md:410` — Step 7 (preferred path).
- `docs/backlog/triaged/FEAT-123.md:55,67` — diagram POC routing.
- `docs/superpowers/plans/2026-06-05-orchestrate-slice-command.md:426`.
- `docs/backlog/done/FEAT-040.md:38`.
- `CHANGELOG.md:320`.
- `.claude/artifacts/loop/auto-dispatch.jsonl` — ~30 records, all `skipReason: cli-refusal-cli-doc-writer-disabled` (loop:document-writer is currently disabled at a CLI gate in this loop install — status signal only, not a blocker).

**Summary**: 2 active in-code dispatches (orchestrate-slice), 3 routing-table rows, no skill or agent-prompt references. Small, well-bounded surface.

---

## 4. Routing-table state

Section **Docs & comms** (`docs/routing-table.md:101–110`):

| Row | Line | Routes to | FEAT-124 action |
|---|---|---|---|
| API documentation authoring (OpenAPI specs, SDK guides, integration guides, error docs, versioning, deprecation notices) | 107 | `copywriter` | Re-route to `loop:document-writer`. |
| Diagram authoring (architecture, flowcharts, sequence, ERDs, state, dependency graphs; Mermaid/PlantUML/Draw.io) | 108 | `copywriter / architect` | Re-route to `loop:document-writer / architect`. Aligns with FEAT-123. |

Section **Crew internals** (`docs/routing-table.md:130`):

| Row | Line | Routes to | FEAT-124 action |
|---|---|---|---|
| Lead-prompt or specialist-agent prompt edit (`agents/{lead,architect,uxdesigner,copywriter}.md`) | 130 | `builder + human-in-loop review` | Remove `copywriter` from the enumeration; keep the row. |

No other routing-table rows reference copywriter or document-writer.

---

## 5. CHANGELOG release-note format

**Hero-crew `CHANGELOG.md` (top, v0.19.0 — 2026-06-07)**:
- H2 heading `## vX.Y.Z — YYYY-MM-DD`
- Bulleted entries with `**type(scope):**` or `**FEAT-NNN**` prefix
- Narrative trailer when relevant
- `---` separator

Pre-1.0 semver per CLAUDE.md ("Minor = closes phase or new commands/skills; Patch = bugfix/doc polish").

**Loop `CHANGELOG.md` (top, v0.28.0 — 2026-06-07)**:
- H2 heading `## vX.Y.Z — YYYY-MM-DD — <headline> (FEAT-NNN)`
- Keep-a-Changelog sub-sections (`### Added`, `### Changed`, `### Roadmap`)
- `---` separator

**Versioning impact for FEAT-124**:
- **hero-crew**: agent deprecation + routing-table re-route + command dispatch change = **minor bump `v0.20.0`** (behavior change reading is more accurate than "doc polish").
- **loop**: extend `loop:document-writer` scope = **minor bump `v0.29.0`** per FEAT-124 acceptance criterion.

---

## 6. Cross-repo coordination — loop-side surface

### Runtime references (loop)
- `hooks/guard-feat-dispatch.mjs:64` — `crew:copywriter` in `allowed` subagent allowlist. **Action**: keep during deprecation cycle; remove in follow-up release.
- `hooks/guard-feat-dispatch.mjs:87` — error-message text enumerates `crew:copywriter`. Same treatment.
- `hooks/guard-feat-dispatch.mjs:15` — comment narrative. Update.
- `src/scripts/lib/model-router.mts:9` — `MODEL_PHASES` includes `"copywriter"`. **Recommendation**: keep through deprecation cycle so presets do not break; remove in follow-up FEAT.

### Preset references (loop)
- `.claude/loop.json:40` — `"copywriter": "sonnet"` in `modelRouting`. Preset key; keep through deprecation.
- All six shipped presets already use `document-writer` as canonical role name (per CHANGELOG v0.28.0) — confirms consolidation direction.

### Agent prompt changes (loop)
- `agents/document-writer.md` — extend `description:` + scope to absorb:
  - API reference (OpenAPI specs, SDK reference, integration guides, error docs, versioning, deprecation notices)
  - Diagram captions / architecture narrative / Mermaid prose
  - (Optional) Custom-instructions cascade `~/.claude/loop/document-writer.md`
  - Add consult-skills: `skills/workflow/api-documentation/`, `skills/domain/diagram-methodology/`, `skills/domain/backend-advisory/`, `skills/domain/architecture-advisory/`
  - Promote `3rdparty/api-documenter` to primary OpenAPI dispatch.

### Loop doc references (historical/narrative)
- `docs/superpowers/specs/2026-06-04-tool-restricted-lead-orchestrator-design.md` — 4 refs.
- `docs/superpowers/specs/2026-06-04-orchestrate-slice-architect-contracts-design.md` — 5 refs.
- `docs/backlog/pending/FEAT-007.md:21`.
- `src/scripts/lib/slice-linker/dispatch.mts:119` — dispatch error-message narrative. **Update** to drop `copywriter`.

### Loop CHANGELOG narrative
- `CHANGELOG.md:403,411,967` — historical; no edit required (append-only history).

---

## Surface summary

### 1. Surface types in scope
- Agent prompts: hero-crew `agents/copywriter.md` (deprecation shim) + loop `agents/document-writer.md` (scope extension).
- Routing table: `docs/routing-table.md` rows 107, 108 (re-route), 130 (narrow enumeration).
- Commands: `commands/orchestrate-slice.md` Step 6 (line 392) + Step 7 (line 410).
- CHANGELOG: top-of-file entries in both repos.
- Skills: zero direct references.
- Loop hooks: `hooks/guard-feat-dispatch.mjs` allowlist + message; keep during deprecation.
- Loop runtime: `src/scripts/lib/model-router.mts` phase array; preset keys; decouple in follow-up.

### 2. Interface boundaries
- Active dispatcher: only `commands/orchestrate-slice.md` (Steps 6 + 7) dispatches `crew:copywriter`.
- Loop never dispatches `crew:copywriter` directly — only allowlists it in the guard hook.
- Migration: update Steps 6 + 7 to dispatch `loop:document-writer` directly; keep `crew:copywriter` as a no-callsite shim for one release cycle (defensive for any out-of-tree custom workflow).

### 3. Behavior changes — observable
- `agents/copywriter.md`: deprecation banner at top + `[DEPRECATED — use loop:document-writer]` prefix in `description:`.
- `loop:document-writer` `description:` expands to cover API docs + diagram captions.
- `docs/routing-table.md` rows 107, 108 route to `loop:document-writer`.
- `commands/orchestrate-slice.md` Steps 6/7 dispatch `loop:document-writer` directly.
- Both CHANGELOGs gain a new entry (hero-crew v0.20.0, loop v0.29.0).

### 4. Data contracts
- N/A. No API surface. Dispatch shape (subagent_type string) is the only contract change.
- Workflow-state / artifact paths unchanged (both write via `write-handoff` to `.claude/artifacts/crew/handoffs/`).

### 5. Stack signals
- `surface:agents` (already tagged) — copywriter.md + document-writer.md.
- `surface:routing` — **recommend adding** to FEAT-124 frontmatter (routing-table edits are first-class).
- `concern:dx` (already tagged).
- `concern:naming` (already tagged).
- Stack: markdown-only in hero-crew; markdown + 1–2 .mjs/.mts comment-line edits in loop (no behavior change). No TypeScript / runtime code changes required for the core FEAT.

---

## Risks / open questions

- **Marketplace cross-pin gap**: hero-crew `.claude-plugin/marketplace.json` only declares `crew` (despite CLAUDE.md instruction to bump `plugins[name=loop].version`). Confirm whether FEAT-124 should add a `loop` entry or whether consumers pin loop separately.
- **`loop:document-writer` currently disabled in this install** (`.claude/artifacts/loop/auto-dispatch.jsonl` shows ~30 skipped dispatches: `cli-refusal-cli-doc-writer-disabled`). Doc-side consolidation lands cleanly; functional verification depends on lifting that CLI gate — separate work.
- **Deprecation horizon**: FEAT-124 says "shim for one release cycle". Add explicit acceptance criterion: when shim is removed (follow-up FEAT? Next minor bump?).
- **Loop `MODEL_PHASES` rename**: out of scope here; triage as follow-up after one release cycle so preset keys align with agent names.
- **FEAT-123 dependency**: diagram POC routes through `loop:document-writer`. Land FEAT-124 first (or together) so FEAT-123's routing rows are not immediately stale.
- **Custom-instructions cascade**: `crew:copywriter` supports `~/.claude/crew/copywriter.md` override. Decide: preserve in shim, document migration to `~/.claude/loop/document-writer.md`, or drop without migration. Users with custom workflows hit this.

---

## Recommended slice shape

**One slice in hero-crew** (markdown edits, deprecation shim):
1. Add deprecation banner to `agents/copywriter.md`; prepend `[DEPRECATED — use loop:document-writer]` to `description:`.
2. Update `docs/routing-table.md` rows 107, 108 (re-route); narrow row 130 enumeration.
3. Update `commands/orchestrate-slice.md` Steps 6 + 7 to dispatch `loop:document-writer` directly.
4. CHANGELOG entry under `v0.20.0`.
5. Add `surface:routing` to FEAT-124 frontmatter.

**Coordinated slice in loop** (markdown + 1 narrative .mts comment):
1. Extend `agents/document-writer.md` `description:` and scope sections (API docs + diagram captions).
2. Add 4 consult-skills (`api-documentation`, `diagram-methodology`, `backend-advisory`, `architecture-advisory`).
3. Promote `3rdparty/api-documenter` to primary dispatch for OpenAPI work.
4. Update `src/scripts/lib/slice-linker/dispatch.mts:119` narrative; update `hooks/guard-feat-dispatch.mjs:15` comment.
5. CHANGELOG entry under `v0.29.0` with `### Added` and `### Deprecation`.
6. **Defer**: do not yet remove `crew:copywriter` from allowlist / `MODEL_PHASES` / preset — follow-up FEAT after one release cycle.

**Release order**: ship loop v0.29.0 first (extended scope), then hero-crew v0.20.0 (re-routes to it). Avoids a window where the routing table points to an under-scoped agent.

---

## Confidence

- **High** on surface mapping (greps complete, both agent files read in full).
- **Medium** on release-coordination strategy (depends on marketplace cross-pin question).
- **Medium** on whether the shim is strictly required — only orchestrate-slice dispatches `crew:copywriter`, so a direct migration would also be defensible. Recommend asking the user before authoring the slice.
