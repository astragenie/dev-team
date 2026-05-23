# Review Result: FEAT-016 context7 adequacy for postgres/terraform/dart/flutter

- Created: 2026-05-23T20:17:04.989Z
- Reviewer: reviewer
- Decision: needs_fix
- Summary: -
- Evidence Checked: -
- Files Reviewed: -
- Test Adequacy: -
- Risks: -
- Required Follow-up: -


## Role Declaration

- **What I own:** Adequacy review of FEAT-016 context7 integration for postgres/terraform/dart/flutter use cases.
- **What I will not change:** No files edited; read-only role.
- **What I need from others:** Nothing — all inputs provided by lead.
- **What I will deliver:** Findings table, gate results, decision, artifact.
- **Gates applied:** TDD gate (FEAT-011), plugin-dev:plugin-validator, plugin-dev:skill-reviewer, routing-table adequacy check per agents/reviewer.md lines 100-108.

## Findings

| # | Axis | Severity | Finding | Recommended Fix |
|---|------|----------|---------|----------------|
| 1 | Dart discoverability | **major** | `skills/domain/dart/dart-conventions/SKILL.md` has no context7 hint. A builder entering a dart context gets zero nudge toward context7 for pub.dev packages (http, riverpod, drift). | Add context7 hint block to `skills/domain/dart/dart-conventions/SKILL.md` citing example packages. |
| 2 | Flutter discoverability | **major** | `skills/domain/flutter/flutter-conventions/SKILL.md` has no context7 hint. Flutter widget deprecation cycles (WillPopScope -> PopScope, etc.) are exactly the high-churn scenario context7 was integrated to handle. | Add context7 hint to `skills/domain/flutter/flutter-conventions/SKILL.md` citing example packages (flutter, provider, go_router). |
| 3 | Postgres discoverability | **major** | No `skills/domain/postgres/` skill exists. The routing-table row's trigger language ("npm package", "unfamiliar npm package") is JS-flavored and will not reliably fire for .sql migrations, psycopg2, asyncpg, or pgvector contexts. | Add `skills/domain/postgres/` domain skill with context7 hint, or amend routing-table to include explicit non-JS examples (.sql, pgvector, asyncpg). |
| 4 | Terraform discoverability | **major** | No `skills/domain/terraform/` skill exists. Routing-table trigger phrase does not fire on .tf file context or HCL provider questions. | Add explicit terraform/HCL examples to routing-table row, or add `skills/domain/terraform/` domain skill with context7 hint. |
| 5 | Routing-table phrasing | **minor** | Trigger column reads "touching unfamiliar npm package" -- anchors to JS mental model. Non-JS stacks will be missed by the lead. | Broaden trigger to: "touching an unfamiliar library or provider in any language/ecosystem (npm, pub.dev, PyPI, Terraform Registry, etc.)". |
| 6 | Coverage uncertainty | **minor** | No confirmed-coverage list for terraform providers, postgres client libs, or dart/flutter pub packages. Users hit silent misses and fall back to "general web docs" without knowing better fallbacks exist (registry.terraform.io, pub.dev). | Document known-covered stacks in README or routing-table note. Name registry.terraform.io and pub.dev as specific fallbacks. |
| 7 | Agent-prompt level | **minor** | `agents/researcher.md`, `agents/builder.md`, `agents/reviewer.md` contain zero mention of context7. Only instruction surfaces are routing-table (lead-consulted) and two JS/TS domain skills. Researcher and builder acting without lead routing will not self-initiate context7. | Add a one-line context7 callout to `agents/researcher.md` rules block. |
| 8 | TDD gate | **nit** | Doc/config-only change. TDD-exempt per FEAT-011 policy. Builder did not explicitly state exemption -- informational only. | No action required. |

## Gate Results

- **TDD gate (FEAT-011):** Exempt -- doc/config change only. No net-new runnable behavior.
- **plugin-dev:plugin-validator:** Applicable (.mcp.json added). CI passes validate-manifests.mjs. No structural defect found. Adequacy scope does not surface new manifest errors.
- **plugin-dev:skill-reviewer:** Applicable (two SKILL.md files edited). JS and TS skill hints are correctly formed. Dart and flutter skills were not edited -- the gap is the finding, not a malformation.
- **Routing-table row:** Checked against docs/routing-table.md per agents/reviewer.md lines 100-108.

## Repo Standards Checked

- `docs/standards/code-conventions.md`: N/A (no runtime code changed).
- Skill tier/frontmatter: JS and TS SKILL.md edits are additive hints; no tier or frontmatter violations introduced.

## Configured Review Skills Consulted

- `plugin-dev:plugin-validator` (per agents/reviewer.md, diff touches .mcp.json)
- `plugin-dev:skill-reviewer` (per agents/reviewer.md, diff touches skills/**/SKILL.md)
- `superpowers:test-driven-development` (TDD gate FEAT-011)

## Evidence Checked

- agents/researcher.md (lines 1-44): no context7 mention
- agents/builder.md (lines 1-65): no context7 mention
- agents/reviewer.md (lines 1-113): no context7 mention
- skills/domain/dart/dart-conventions/SKILL.md: not in diff, no hint present (per scope pre-gather)
- skills/domain/flutter/flutter-conventions/SKILL.md: not in diff, no hint present (per scope pre-gather)
- Routing-table row phrasing: confirmed JS-flavored trigger examples only
- No postgres or terraform domain skills in repo

## Confidence Level

High. All evidence is structural (file existence, phrasing in named files). Coverage empirical gap (axis 6) treated as documented uncertainty per scope constraints.

## Decision

**needs_fix** -- 4 major findings, 3 minor findings. Adequate for JS/TS. Not adequate for postgres, terraform, dart, or flutter until major findings are resolved.
