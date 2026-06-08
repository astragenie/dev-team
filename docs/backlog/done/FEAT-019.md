---
id: FEAT-019
status: done
priority: P2
category: workflow
target_release: v0.4.0
created: 2026-05-23
updated: 2026-05-23
depends_on: [FEAT-016, FEAT-017]
slices: [SLICE-01]
derived_from: null
autonomous_safe: false
phase: 1
started_at: 2026-05-23
completed_at: 2026-05-23
github_issue: 20
github_milestone: 1
github_url: "https://github.com/sergeymilashico/hero-crew/issues/20"
---
# FEAT-019: wire context7 / plugin-dev / microsoft-docs + terraform skills into crew agents

## Description

FEAT-016 installed `context7` MCP for live library docs. FEAT-017
wired `plugin-dev:plugin-validator` + `skill-reviewer` into the
reviewer phase. Coverage gap: builders rediscover APIs from training
data, reviewers do not consult MS-SDK signature checks, researchers
have no explicit Microsoft-docs grounding step, and terraform work
has no skill backing despite being the operator's primary IaC tool.

This FEAT extends the routing-table + builder/reviewer/researcher
prompts so every crew role has explicit, named skill calls for its
top external-knowledge needs.

**Stack** (operator-stated):

- IaC: `terraform` for ~everything that has infra.
- Mobile: `flutter` — out-of-scope for skill wiring; no Claude Code
  skills exist for it across the 8 surveyed sources.
- Cloud-specific Azure skill wiring: **explicitly out of scope** —
  reverted per operator decision. The `azure:*` plugin is too big and
  too coupled to azd workflow; operator prefers narrow terraform-CLI
  path. May revisit in a future FEAT if Azure-specific gaps emerge.

**Skill sources in scope:**

- `context7` (MCP, FEAT-016) — generic live library docs.
- `microsoft-docs:microsoft-code-reference` — MS SDK signature check.
- `microsoft-docs:microsoft-docs` — MS concept / limits / config lookup.
- `plugin-dev:agent-development` — guidance when editing `agents/*.md`.
- `plugin-dev:skill-development` — guidance when editing `skills/`.
- `hashicorp:terraform-*` — official HashiCorp skills for HCL, modules,
  providers, testing, Packer (installed via `hashicorp/agent-skills`
  plugin in a separate setup step — not part of this FEAT's deliverable).
- `terraform-skill` (vendored from `daymade/claude-code-skills`, MIT)
  — operational traps + multi-env reliability patterns (vendored in
  a separate FEAT — not part of this FEAT's deliverable).

## Scope

In scope:

- **Routing-table additions** in `docs/routing-table.md` (6 new rows,
  down from rev2's 12 — azure-* rows dropped):

  | Signal | Route to | Notes |
  |---|---|---|
  | Building / editing Microsoft SDK code | builder via `microsoft-docs:microsoft-code-reference` | Catches hallucinated signatures pre-merge. |
  | Microsoft tech concept question (limits, configs, capabilities) | researcher via `microsoft-docs:microsoft-docs` | Authoritative MS docs lookup. |
  | Editing this plugin's own `agents/*.md` | builder via `plugin-dev:agent-development` | Downstream reviewer gate: see existing "Plugin shape change" row — do not skip. |
  | Editing this plugin's own `skills/**/SKILL.md` | builder via `plugin-dev:skill-development` | Downstream reviewer gate: see existing "Skill shape change" row — do not skip. |
  | Authoring or editing Terraform HCL / modules | builder + reviewer via `hashicorp:terraform-*` (when installed) + vendored `terraform-skill` (when vendored) | Skills pulled in by separate setup / vendor FEATs; routing-table row stays valid even if not yet installed. |
  | Terraform operational issue (state drift, multi-env config, upgrade path) | researcher + builder via vendored `terraform-skill` ops-traps section | Pairs with `hashicorp:terraform-*` for code-shape questions. |

  Plus extend the existing FEAT-016 context7 row to explicitly name
  reviewer + builder as consumers (currently lists only researcher /
  builder).

- **Agent prompt addendums** (stay ≤200 lines per agent — bullet-style
  "consult X when Y" entries citing routing-table headings, no inlining):
  - `agents/builder.md` — context7, microsoft-code-reference,
    plugin-dev:{agent,skill}-development, terraform skills.
  - `agents/reviewer.md` — append context7 + microsoft-code-reference +
    terraform skills to existing FEAT-017 "Reviewer skill checklist".
  - `agents/researcher.md` — context7 + microsoft-docs as primary doc
    sources before web fallback.
  - `agents/lead.md` — **no prompt edit**. Lead consults routing-table
    only. 169/200 line cap; 31-line headroom reserved.
  - `agents/validator.md` — **no prompt edit in this FEAT**. Azure-
    specific validate skill is dropped from scope; no other generic
    skill earns inclusion here yet.
  - `agents/deployer.md` — **no prompt edit in this FEAT**. Azure-
    specific deploy skill is dropped from scope; terraform CLI is the
    operator-known happy-path and does not need agent-prompt wiring
    (the routing-table row is the single point of guidance).

- **CLAUDE.md callout** — single line under "Skill taxonomy"
  section pointing at the new routing rows. **SLICE-A owns all
  CLAUDE.md edits for this FEAT**; later slices may not modify it
  (prevents parallel-slice merge collision).

- **Architecture doc** — short subsection in
  `docs/architecture/architecture.md` under "Skill tiers" titled
  "External plugin skills as routed dependencies" — records the
  pattern: route by signal, name skill by exact ID, no inlining,
  single point of rename = routing-table row heading.

Out of scope:

- All `azure:*` plugin skill wiring (azure-prepare, azure-deploy,
  azure-validate, azure-diagnostics, azure-cost, azure-rbac,
  azure-quotas, azure-compliance, azure-reliability, applens,
  azureterraform, azureterraformbestpractices). Operator decision:
  azure plugin removed from scope.
- `.claude/crew.json` `stack.cloud` / `stack.iac` flags (no Azure
  gating means no stack-flag need; existing crew.json schema stays
  untouched).
- `scripts/validate-crew-config.mjs` — no schema additions = no
  validator.
- `scripts/lib/briefing/{collect,render}.mjs` "Routed skills" surface
  — defer to a follow-up FEAT once routing rows + agent addendums
  prove they are stable.
- Installing `hashicorp/agent-skills` plugin — separate setup task.
- Vendoring `daymade/terraform-skill` + other MIT skills — separate
  FEAT (see "Forward pointers" below).
- Flutter / dart skill wiring — no Claude Code skills exist for
  flutter across surveyed sources; deferred until upstream coverage
  appears.
- Researcher / azure-cost wiring — out per azure removal.

## Forward pointers

- **FEAT-020 (proposed)**: Vendor MIT-licensed skills into
  `skills/{domain,workflow}/`. Candidates: daymade `terraform-skill`,
  hesreallyhim `/commit` (conventional commits), `/tdd`, `/fix-pr`,
  akin-ozer `cc-devops-skills` selective subset. Per-skill license
  check + tier alignment + `validate-skills.mjs` pass.
- **FEAT-021 (proposed)**: Install `hashicorp/agent-skills` plugin
  (terraform HCL / modules / providers / testing / Packer) + `nizos/
  tdd-guard` hook + `anthropics/skills:webapp-testing`. Marketplace
  pin updates.
- **FEAT-022 (proposed)**: Author flutter skills locally (`skills/
  domain/flutter/`) once flutter work frequency justifies authoring
  ~3–4 hours per skill. Defer until first frequency spike.

## Suggested slice decomposition

- **SLICE-A**: routing-table additions (6 new rows + context7
  extension) + CLAUDE.md callout + architecture doc subsection.
  Docs-only; smallest reversible. **SLICE-A is exclusive owner of
  CLAUDE.md edits for this FEAT** (SLICE-B may not modify it).
- **SLICE-B**: builder + reviewer + researcher prompt addendums.
  Cites routing-table headings from SLICE-A.

Dependency order: A → B. (SLICE-C/D/E from rev2 dropped along with
azure scope.)

## Acceptance hints

- `docs/routing-table.md` shows 6 new rows + context7 row extension
  per the table above; `brief-me` does not flag staleness.
- Each touched agent prompt cites its added skills by exact ID
  (`context7`, `microsoft-docs:microsoft-code-reference`,
  `plugin-dev:agent-development`, etc.). Verifiable via grep.
- Builder dispatched against an MS-SDK editing task invokes
  `microsoft-docs:microsoft-code-reference` before producing the diff;
  evidence appears in the handoff artifact (SLICE-B acceptance).
- Reviewer dispatched against an agent-prompt edit invokes
  `plugin-dev:agent-development` findings in `write-review-result`
  (SLICE-B acceptance).
- No lint, format, typecheck, or test regressions
  (`npm run lint && npm test`).
- Total per-agent prompt length stays ≤200 lines (HARD).
- `git diff --name-only main...HEAD` for SLICE-A returns only
  `docs/routing-table.md`, `CLAUDE.md`, `docs/architecture/architecture.md`
  (+ slice file + this FEAT-019 path).

## Risks / open questions

- **Prompt bloat.** Lead at 169/200; builder/reviewer/researcher each
  have ≥87 lines slack. Bullet-style addendums (3–5 lines per agent)
  fit comfortably. Lead deliberately excluded from prompt edits.
- **Upstream plugin rename.** Skill IDs are external surface.
  Routing-table is the single point of update — agent prompts cite
  the row heading, not the bare skill ID, so a rename is a one-line
  table edit.
- **Forward-pointer slip.** FEAT-020/021/022 are proposed but not
  promoted. If they slip, the routing rows for terraform skills point
  at uninstalled plugins / unvendored skills. Mitigation: row Notes
  explicitly say "when installed" / "when vendored"; the row stays
  documentation-valid even if the skills are absent. Reviewer + builder
  fall back to base behavior with no harm.
- **CLAUDE.md merge collision.** SLICE-A is exclusive owner; SLICE-B
  references but does not modify.
- **`autonomous_safe: false`** — this FEAT edits agent prompts.
  Lead-prompt-edits and skill-routing changes require human-in-loop on
  review per autonomous-loop policy.
- **Re-introducing azure later.** If a future FEAT brings azure
  wiring back, the existing routing-table structure accommodates it
  cleanly — add rows without restructuring. No design debt incurred
  by the strip.
