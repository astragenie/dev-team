---
id: SLICE-46
feature: FEAT-124
title: Loop side — extend document-writer scope (API docs + diagram captions)
status: pending
priority: P2
autonomous_safe: false
cross_repo: loop
target_repo: C:\work\mega\loop
target_release: loop v0.29.0
created: 2026-06-07
---

# SLICE-46: Loop side — extend document-writer scope

Ships first per FEAT-124 sequencing decision. Hero-crew SLICE-47 depends on this landing.

## Parent feature

FEAT-124 — Consolidate `crew:copywriter` → `loop:document-writer`. Hard-cut deprecation strategy. See `.claude/artifacts/crew/designs/FEAT-124-contracts.md`.

## Objective

Extend `loop:document-writer` to absorb the documentation scope currently held by hero-crew's `crew:copywriter` so hero-crew can hard-cut its agent in SLICE-47 without routing rows pointing at an under-scoped agent.

## Work location

**Executes in `C:\work\mega\loop`** (separate repo). Open a sibling worktree or `cd` per loop's own workflow. Slice file lives in hero-crew because FEAT-124 is tracked here.

## In scope

1. **`agents/document-writer.md` prompt extension**:
   - Extend `description:` to cover: API reference docs (OpenAPI, SDK guides, integration guides, error docs, versioning, deprecation notices), diagram captions, architecture narrative, Mermaid prose.
   - Add `Agent` to `tools:` list (enables 3rdparty dispatch). **Do NOT add `Bash`** — preserve Markdown-only boundary.
   - Add four consult-skills rows: `skills/workflow/api-documentation/`, `skills/domain/diagram-methodology/`, `skills/domain/backend-advisory/`, `skills/domain/architecture-advisory/`.
   - Add three 3rdparty delegation-map rows: `agents/3rdparty/api-documenter.md`, `agents/3rdparty/diagram-architect.md`, `agents/3rdparty/markdown-syntax-formatter.md`.
2. **Narrative-only edits** (no behavior change):
   - `src/scripts/lib/slice-linker/dispatch.mts:119` — drop `copywriter` from dispatch error-message enumeration.
   - `hooks/guard-feat-dispatch.mjs:15` — update comment narrative referencing `crew:copywriter`.
3. **CHANGELOG.md** — under v0.29.0:
   - `### Added` — extended `document-writer` scope (API docs + diagram captions) per FEAT-124.
   - `### Deprecation` — announce `crew:copywriter` hard-cut in hero-crew v0.20.0.
4. **Version bump**: loop v0.29.0 (minor) in `package.json` + `.claude-plugin/marketplace.json`.
5. **PR** to loop repo (current branch `feat/triage-tighten-and-followups` or new).

## Out of scope

- `crew:copywriter` allowlist removal from `hooks/guard-feat-dispatch.mjs` (defer until after hero-crew v0.20.0 cuts the agent — follow-up FEAT).
- Custom-instructions cascade (`~/.claude/loop/document-writer.md`) — flagged but not blocking.
- Any change to `loop:document-writer` model/effort/maxTurns.

## Acceptance criteria

- [ ] `loop:document-writer` description covers API docs + diagram captions explicitly (grep validates new keywords)
- [ ] `tools:` list contains `Agent` and does NOT contain `Bash`
- [ ] 4 consult-skills + 3 3rdparty delegation rows present
- [ ] `slice-linker/dispatch.mts` + `guard-feat-dispatch.mjs` narrative updated (CI green)
- [ ] CHANGELOG v0.29.0 entry with both `### Added` + `### Deprecation` subsections
- [ ] `package.json` + `marketplace.json` versions match at v0.29.0
- [ ] Loop CI green (`npm test`, lint, validators)
- [ ] PR opened and ready for human review (autonomous_safe=false)

## Risks

- Adding `Agent` tool to `loop:document-writer` is a privilege expansion — review carefully against the five anti-hallucination rules in the existing prompt.
- Hard cut on hero-crew side (SLICE-47) becomes a silent break for any external workflow pinning `crew:copywriter` if this slice doesn't land first. Sequencing is load-bearing.

## Dispatch instruction

`/crew:build SLICE-46` after `/loop:slice start --id SLICE-46`. Builder works in `C:\work\mega\loop`. Reviewer should consult `agents/document-writer.md` change against `.claude/artifacts/crew/designs/FEAT-124-contracts.md` § Capability delta table.
