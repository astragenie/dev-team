---
title: Cross-check routing-table rows against agent "Skills you consult" blocks
date: 2026-06-04
status: draft
authors: [lead]
related:
  - docs/superpowers/specs/2026-06-04-3rdparty-agent-skill-extraction-design.md
---

# Routing-table ↔ agent-block consistency validator

## Problem

`docs/routing-table.md` maps signals → crew roles → cited skills. Each first-party crew agent file (`agents/<role>.md`) carries a static "### Skills you consult (per routing-table)" block listing skills relevant to that role.

These two surfaces must stay in sync. Today they only match by **manual authoring**:

- If someone adds a new row "`*.go edit → builder → go-pro skill`" to the routing-table but forgets to update `agents/builder.md`, no validator catches the drift.
- If a skill is renamed in `skills/` and the routing-table is updated but the agent block isn't (or vice versa), no validator catches it.
- `scripts/validate-routing-table.mjs` only checks skill IDs in the routing-table resolve to real skills — it never reads agent files.

This gap was identified in a brainstorm session after FEAT-A through Slice 5 wired ~13 new routing-table rows across 9 agents. Manual cross-author kept them aligned this time. As routing-table grows past 70 rows, manual authoring will drift.

## Goal

Extend `scripts/validate-routing-table.mjs` with a cross-check pass:

For every routing-table row that names a crew agent in its "Route to" column AND cites a `skills/` path in its Notes column, verify the cited skill path appears in that agent's "Skills you consult" H3 block in `agents/<agent>.md`. Report mismatches as CI errors.

## Non-goals

- Behavior testing — dispatching agents and verifying runtime skill consultation. Untestable statically; deferred to future work.
- Validating external-plugin skill citations (`context7`, `microsoft-docs:*`, etc.) — those are not in agent blocks today and the existing validator already handles their resolution.
- Reformatting agent files or routing-table content. Read-only check.
- Modifying agent prompts — that's authoring work, not validation.

## Goals (detail)

1. Parser detects "Skills you consult" H3 block in each `agents/<crew-role>.md` file and extracts cited skill paths (`skills/<tier>/<name>/`).
2. Parser extracts routing-table rows where:
   - "Route to" cell names a crew role (`dispatcher`, `builder`, `reviewer`, `validator`, `deployer`, `researcher`, `architect`, `uxdesigner`, `copywriter`) — extension agents included.
   - "Notes" cell contains a `skills/<tier>/<name>/` path.
3. Cross-check: for each (agent, skill-path) pair in routing-table, the same path appears in that agent's "Skills you consult" block.
4. Mismatches reported with: row content + agent + missing skill path + suggested action.
5. New validator path is hard CI error (matches behavior of other validators).
6. Test fixtures use in-tree pattern (`tests/fixtures/validate-routing-table/<scenario>/`).

## Non-goals (detail)

- Whitespace / formatting tolerance — strict path match. If routing-table says `skills/domain/typescript-pro/` and agent block says `skills/domain/typescript-pro` (no trailing slash), normalize trailing slash but otherwise strict.
- Multi-cite handling — if routing-table cites multiple skills in one row (e.g., `cite skills/domain/ai-engineering/ + skills/domain/prompt-engineering/`), each must appear in the agent block (one row → multiple checks).
- Co-cite via existing rows — when routing notes say "co-cite alongside `crew:terraform-ops-traps`", the explicit `skills/` path is the only one checked; the co-cite name is informational.

## Parsing rules

### Agent "Skills you consult" block

Strict H3 detection:

```
### Skills you consult (per routing-table)

- <signal> → `skills/<tier>/<name>/`
- ...
```

Or `### Skills you consult` without the parenthetical (be lenient on the parenthetical; require the heading text "Skills you consult").

Extract every `skills/<segment>/<segment>/` path in the block body (between this H3 and the next heading). Backtick-wrapped or plain text both count. Normalize trailing slash.

### Routing-table row

Each row is a markdown table line: `| Signal | Route to | Notes |`. The Notes cell may contain inline backtick paths.

- "Route to" cell — extract identifiers matching `^(lead|builder|reviewer|validator|deployer|researcher|architect|uxdesigner|copywriter)$` (case-insensitive; multiple per cell via `/`, `+`, or comma).
- "Notes" cell — extract every `skills/<tier>/<name>/` path (with or without trailing slash, with or without `references/...` suffix — but only the directory part `skills/<tier>/<name>/` is the check unit).

### Cross-check

For each (agent, skill-path) pair extracted from the routing-table:
- If agent is not a known crew role → skip (3rdparty / external agents not enforced).
- If skill-path is not under `skills/<tier>/<name>/` → skip.
- If the agent's "Skills you consult" block does not contain the skill-path → error.

### Carve-outs

The existing validator has a `routing-lint:ignore` row-level marker. Same carve-out applies: rows marked `<!-- routing-lint:ignore -->` skip the cross-check too.

## Algorithm

```
1. Read docs/routing-table.md → parse table rows → emit [(agent, skill_path)] pairs.
2. For each known crew agent file (agents/{lead,builder,reviewer,validator,deployer,
   researcher,architect,uxdesigner,copywriter}.md):
     a. Read file.
     b. Locate "### Skills you consult" H3 block (case-insensitive, accept with or
        without parenthetical).
     c. Extract all skills/<tier>/<name>/ paths in that block.
     d. Store as agent → Set<skill_path>.
3. For each (agent, skill_path) from step 1:
     a. If agent ∉ known set OR row has routing-lint:ignore → skip.
     b. If skill_path ∉ agent's Set → push error.
4. If errors → exit 1 with structured report.
5. Else exit 0.
```

## Test fixtures

`tests/fixtures/validate-routing-table/` already exists. Add scenarios:

| Fixture dir | Scenario | Expected outcome |
|---|---|---|
| `consistency-pass/` | routing-table row routes to builder cites typescript-pro; builder.md block includes typescript-pro path | exit 0 |
| `consistency-fail/` | routing-table row routes to builder cites go-pro; builder.md block does NOT include go-pro | exit 1, error report names builder + go-pro |
| `consistency-ignore/` | row marked `routing-lint:ignore`; cited skill missing from agent block | exit 0 (carve-out works) |
| `consistency-multi/` | routing-table row cites 2 skills; only 1 in agent block | exit 1, single error for the missing one |
| `consistency-non-crew/` | row routes to a non-crew name (e.g., `crew:terraform-ops-traps` cite) | exit 0 (skipped) |

Each fixture contains a minimal `routing-table.md` and `agents/<role>.md` to drive the validator under the existing env-override pattern (`CREW_VALIDATE_ROUTING_TABLE_FILE` / `CREW_VALIDATE_ROUTING_TABLE_REPO_ROOT`).

## CLI integration

The cross-check runs as part of the existing validator command:

```
node ./scripts/validate-routing-table.mjs
```

When `CREW_VALIDATE_ROUTING_TABLE=1` (existing toggle):
- Pass 1: ID resolution (existing behavior, unchanged).
- Pass 2: agent-block cross-check (new).

Both passes must pass for the validator to exit 0. Errors from either pass are reported together.

Local CI gates document at `CLAUDE.md` (CI gates section) does not need a new line — the existing `validate-routing-table.mjs` step covers this.

## Acceptance criteria

1. `node ./scripts/validate-routing-table.mjs` exits 0 against current repo state (all 9 crew agent blocks consistent with routing-table after Slice 1–5 work).
2. New tests pass: 5 fixtures cover pass / fail / ignore / multi / non-crew scenarios.
3. Existing 4 `validate-routing-table` tests still pass (no regression).
4. `node --test` exits 0 with 9 tests in `tests/validate-routing-table.test.mjs`.
5. Validator script stays ≤300 lines (current ~150; new logic adds ~50–80).
6. Lint zero-warning, format pass, typecheck pass.
7. Failure messages are actionable: name the routing-table row, agent file, and missing skill path.

## Risks

| Risk | Mitigation |
|---|---|
| False positives on signal phrasing that mentions a skill path in context (e.g., note text "Replaces skills/old/X/") | Strict cell-by-cell parsing — only "Notes" column scanned for skill paths, only "Route to" column scanned for crew roles |
| Agent block format drift (someone writes `## Skills you consult` H2 instead of `### Skills you consult` H3) | Strict H3 detection + advisory warning in validate-agents for missing block (separate slice if needed) |
| Validator complexity grows over time | Single function for cross-check, ≤80 lines added; structured fixtures |
| External-plugin skill IDs (context7, microsoft-docs:*) in routing-table notes | Existing ID-resolution pass handles these; cross-check only fires on `skills/<tier>/<name>/` paths |
| Routing-table notes col contains the skill path in prose, not as canonical path | Spec restricts the check to paths matching the regex `skills/(universal|workflow|domain|meta)/[a-z0-9-]+/?` — anything else ignored |

## Effort and decomposition

Single FEAT, single slice:

- Extend `scripts/validate-routing-table.mjs` (~50–80 LOC added)
- Add 5 fixture scenarios under `tests/fixtures/validate-routing-table/`
- Add 5 tests to `tests/validate-routing-table.test.mjs`
- Update inline JSDoc comments

**Total: 3–4h. 1 commit.**

## Out of scope (deferred)

- Behavior tests via real Agent dispatch — deferred, see brainstorm Option B.
- Extending the cross-check to non-crew agents (3rdparty) — those are not expected to have "Skills you consult" blocks.
- Linter for "Skills you consult" block presence — separate slice; could fold into `validate-agents.mjs` later.
- Routing-table category grouping (H3 sections to group rows by domain) — separate slice if directory growth slows lead.
