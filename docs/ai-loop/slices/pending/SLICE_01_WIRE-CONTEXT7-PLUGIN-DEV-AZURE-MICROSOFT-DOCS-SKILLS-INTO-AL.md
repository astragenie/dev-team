---
id: SLICE-01
status: pending
feature: FEAT-019
priority: P2
target_release: v0.4.0
created: 2026-05-23
updated: 2026-05-23
---
# SLICE-01: routing-table + CLAUDE.md callout + architecture doc subsection (FEAT-019 SLICE-A)

Implements **SLICE-A only** of FEAT-019 — the smallest reversible delivery. No agent prompt edits, no code changes. See [feature file](../../../backlog/in-progress/FEAT-019.md) for full context, scope rationale, and downstream slice (B).

## Objective

Land the routing layer for the FEAT-019 skill-wiring effort so SLICE-B has a stable target to cite. SLICE-A is the **exclusive owner of CLAUDE.md edits for FEAT-019** — SLICE-B must reference but not modify CLAUDE.md (prevents merge collision).

## In scope

- **`docs/routing-table.md`** — append 6 new rows + 1 extension to existing context7 row, per FEAT-019 scope table:
  1. Building / editing Microsoft SDK code → builder via `microsoft-docs:microsoft-code-reference`
  2. Microsoft tech concept question (limits, configs) → researcher via `microsoft-docs:microsoft-docs`
  3. Editing this plugin's own `agents/*.md` → builder via `plugin-dev:agent-development` (with "downstream reviewer gate: see existing 'Plugin shape change' row — do not skip" cross-reference)
  4. Editing this plugin's own `skills/**/SKILL.md` → builder via `plugin-dev:skill-development` (with "downstream reviewer gate: see existing 'Skill shape change' row — do not skip" cross-reference)
  5. Authoring or editing Terraform HCL / modules → builder + reviewer via `hashicorp:terraform-*` (when installed) + vendored `terraform-skill` (when vendored). Notes column must say "when installed" / "when vendored" so row stays valid even before FEAT-020/021 land.
  6. Terraform operational issue (state drift, multi-env config, upgrade path) → researcher + builder via vendored `terraform-skill` ops-traps section
  - **Extend** existing context7 row Notes to explicitly name reviewer + builder as consumers (currently lists only researcher/builder).

- **`CLAUDE.md`** — one-line callout under "Skill taxonomy" section pointing at the new routing rows. Reference FEAT-019 as authoritative source.

- **`docs/architecture/architecture.md`** — new subsection under "Skill tiers" titled "External plugin skills as routed dependencies". Records pattern: route by signal, name skill by exact ID, no inlining, single point of rename = routing-table row heading.

- Touch routing-table.md mtime so `brief-me` does not flag staleness.

## Out of scope

- Agent prompt edits (any `agents/*.md`) — owned by SLICE-B.
- All azure-* skill wiring (operator removed from FEAT-019 scope).
- `.claude/crew.json` schema changes (no stack flags needed without azure).
- Any code, test, or script changes. SLICE-A is docs-only.
- Installing `hashicorp/agent-skills` or vendoring `terraform-skill` — separate FEAT-020/021 work.
- Authoring flutter skills — separate FEAT-022 (deferred until frequency justifies).

## Acceptance criteria

- [ ] **AC-1** `docs/routing-table.md` contains all 6 new rows + context7 row extension matching FEAT-019 scope table. Verify by grep: each of the 6 new row headings present; context7 row Notes mentions reviewer + builder.
- [ ] **AC-2** `docs/routing-table.md` mtime is within last 24 hours; `node scripts/crew.mjs wake-up --repo "$PWD"` does not include any staleness warning for routing-table.
- [ ] **AC-3** `CLAUDE.md` gains a one-line callout under the "Skill taxonomy" section naming the new routing rows. Verify by grep: the line exists; "Skill taxonomy" section line count grows by exactly 1 (modulo blank-line normalization).
- [ ] **AC-4** `docs/architecture/architecture.md` "Skill tiers" section gains a subsection "External plugin skills as routed dependencies" containing the routing-pattern paragraph. Verify by grep for the heading + key phrase.
- [ ] **AC-5** No regressions: `npm run lint && npm run format:check && npm run typecheck && npm test && node ./scripts/validate-manifests.mjs && node ./scripts/validate-skills.mjs` all pass.
- [ ] **AC-6** No files under `agents/` modified. Verify by `git diff --name-only main...HEAD | grep '^agents/'` returning empty.
- [ ] **AC-7** No files under `scripts/`, `tests/`, `commands/`, `hooks/`, `.claude-plugin/` modified. Verify by `git diff --name-only main...HEAD` returning only `docs/routing-table.md`, `CLAUDE.md`, `docs/architecture/architecture.md` (+ this slice file + FEAT-019 path move).

## Done When

- AC-1..7 PASS with evidence per `01-loop-control/EVIDENCE_RULES.md`.
- Reviewer A verdict = pass (or approved_with_notes with all notes folded same-pass).
- Crew `final-synthesis` artifact written via `node "C:/Users/serge/.claude/plugins/cache/astra/crew/0.3.1/scripts/crew.mjs" write-final-synthesis ...`.
- Slice file moved from `slices/pending/` → `slices/completed/`.
- **FEAT-019 stays in `backlog/in-progress/`** — does NOT move to `done/` until SLICE-B closes.

## Reviewer ladder

- **Reviewer A**: `crew:reviewer` — correctness review against FEAT-019 spec + routing-table style consistency check (6-of-6 row spot-check). Standards: FEAT-019 in-scope list, existing 18 routing-table rows for heading conventions, CLAUDE.md ≤200-line cap not at risk (no agent edits).
- **Reviewer B**: **N/A — documented reason**. No plugin-shape diff (no `.claude-plugin/`, `agents/`, `commands/`, `hooks/`, `.mcp.json` changes) → `plugin-dev:plugin-validator` does not trigger. No `skills/**/SKILL.md` diff → `plugin-dev:skill-reviewer` does not trigger. Single-reviewer gate sufficient for docs-only delivery; if scope expands during implementation, escalate to add a second reviewer before merge.
