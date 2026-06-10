---
id: SLICE-47
feature: FEAT-124
title: "Hero-crew side — hard cut crew:copywriter, update routing-table + commands"
status: completed
priority: P2
autonomous_safe: false
cross_repo: hero-crew
target_repo: "C:\work\mega\hero-crew"
target_release: hero-crew v0.20.0
depends_on: [SLICE-46]
created: 2026-06-07
completed_at: 2026-06-07
updated: 2026-06-07
github_issue: 112
github_url: "https://github.com/sergeymilashico/hero-crew/issues/112"
---
# SLICE-47: Hero-crew side — hard cut crew:copywriter

Ships after SLICE-46 lands in loop v0.29.0. Hard-cut decision per FEAT-124 user confirmation (no shim).

## Decision record — shim vs hard cut

**Decision:** Hard cut (no shim).
**Rationale (user, 2026-06-07):** Only 2 in-tree callsites depend on `crew:copywriter`. Shim adds maintenance burden across 2 repos for an unknown number of external consumers. Per architect's alternative recommendation in `.claude/artifacts/crew/designs/FEAT-124-contracts.md` § Design notes § Deprecation strategy.
**Sign-off:** User explicit via AskUserQuestion in foreground session — "Hard cut now" + "Loop v0.29.0 first, then hero-crew v0.20.0 minor (Recommended)".
**Mitigation for external consumers:** CHANGELOG `### Breaking` entry + routing-table migration comment row with 6-month TTL.

## Parent feature

FEAT-124 — Consolidate `crew:copywriter` → `loop:document-writer`. See `.claude/artifacts/crew/designs/FEAT-124-contracts.md`.

## Objective

Delete `agents/copywriter.md`, update the 2 in-tree callsites + routing-table + governance enumeration + CHANGELOG. Minor bump v0.20.0 because dispatch identifiers in commands change.

## Blocking dependency

**SLICE-46 must be merged to loop main + loop v0.29.0 released** before this slice opens. Otherwise hero-crew routing rows will point at an under-scoped `loop:document-writer`.

## In scope

1. **Delete `agents/copywriter.md`** — hard cut.
2. **`commands/orchestrate-slice.md` callsite updates**:
   - Line 392 (Step 6 — CHANGELOG drafting): `crew:copywriter` → `loop:document-writer`.
   - Line 410 (Step 7 — release-notes drafting): drop fallback chain, dispatch `loop:document-writer` directly.
3. **`docs/routing-table.md` row updates** (3 rows total):
   - Section **Docs & comms** → "API documentation authoring": `copywriter` → `loop:document-writer`.
   - Section **Docs & comms** → "Diagram authoring": `copywriter / architect` → `loop:document-writer / architect` (update notes column too).
   - Section **Crew internals** → "Lead-prompt edit or specialist-agent prompt edit": drop `copywriter` from `{lead,architect,uxdesigner,copywriter}` enumeration; update narrative "All four" → "All three".
4. **Grep + sweep** any remaining `crew:copywriter` refs across the repo. Expected zero after the above edits except in CHANGELOG.
5. **CHANGELOG.md v0.20.0**:
   - `### Removed` — `crew:copywriter` agent (FEAT-124). Migration: replace `subagent_type: crew:copywriter` with `subagent_type: loop:document-writer`. Loop v0.29.0 prerequisite.
   - `### Changed` — routing-table rows + orchestrate-slice command callsites updated.
   - `### Breaking` heading — silent dispatch failure for callers still typing `crew:copywriter`.
6. **Version bump**: hero-crew v0.20.0 (minor) in `package.json` + `.claude-plugin/marketplace.json`. Also bump `marketplace.json` loop entry to `>=0.29.0`.

## Out of scope

- Any change to other agent prompts.
- Any change to skills.
- Removing `crew:copywriter` references from CHANGELOG history (preserve audit trail).

## Acceptance criteria

- [ ] `agents/copywriter.md` deleted
- [ ] `commands/orchestrate-slice.md` no longer contains `crew:copywriter`
- [ ] `docs/routing-table.md` no longer contains `copywriter` (other than possibly in historical comments)
- [ ] `grep -r "crew:copywriter" --exclude-dir=.git --exclude=CHANGELOG.md` returns zero matches (excluding deliberate audit-trail entries)
- [ ] CHANGELOG v0.20.0 entry with `### Removed`, `### Changed`, `### Breaking` subsections
- [ ] `package.json` + `marketplace.json` (crew plugin) at v0.20.0
- [ ] `marketplace.json` loop entry pinned `>=0.29.0`
- [ ] CI green (all 11 gates from CLAUDE.md "CI gates")
- [ ] PR opened and ready for human review (autonomous_safe=false)

## Risks

- External workflows pinning `crew:copywriter` break silently with `subagent-not-found`. Mitigated by CHANGELOG `### Breaking` heading + routing-table comment row preserving prior identifier (6-month TTL per architect recommendation).
- If loop v0.29.0 hasn't shipped, this slice's routing rows point at under-scoped agent.

## Dispatch instruction

`/crew:build SLICE-47` after SLICE-46 closes and loop v0.29.0 publishes. Reviewer must verify the grep gate + that `marketplace.json` loop pin `>=0.29.0` matches the actual loop release.
