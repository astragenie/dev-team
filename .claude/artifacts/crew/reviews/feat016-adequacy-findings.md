## Findings

| # | Axis | Severity | Finding | Recommended Fix |
|---|------|----------|---------|----------------|
| 1 | Dart discoverability | major | dart-conventions SKILL.md has no context7 hint. A builder entering a dart context gets zero nudge toward context7 for pub.dev packages. | Add context7 hint block to skills/domain/dart/dart-conventions/SKILL.md citing example packages (http, riverpod, freezed). |
| 2 | Flutter discoverability | major | flutter-conventions SKILL.md has no context7 hint. Flutter widget deprecation cycles are exactly the high-churn scenario context7 was integrated to handle. | Add context7 hint to skills/domain/flutter/flutter-conventions/SKILL.md citing example packages (flutter, provider, go_router). |
| 3 | Postgres discoverability | major | No skills/domain/postgres/ skill exists. Routing-table trigger language (npm package, unfamiliar npm package) is JS-flavored and will not reliably fire for .sql migrations, psycopg2, asyncpg, or pgvector contexts. | Add skills/domain/postgres/ domain skill with context7 hint, or amend routing-table to add explicit non-JS examples. |
| 4 | Terraform discoverability | major | No skills/domain/terraform/ skill exists. Routing-table trigger phrase does not fire on .tf file context or HCL provider questions. | Add explicit terraform/HCL examples to routing-table row, or add skills/domain/terraform/ domain skill with context7 hint. |
| 5 | Routing-table phrasing | minor | Trigger column reads touching unfamiliar npm package -- anchors to JS. Non-JS stacks (terraform, postgres, dart pub packages) will be missed by the lead. | Broaden trigger to: touching an unfamiliar library or provider in any language/ecosystem (npm, pub.dev, PyPI, Terraform Registry, etc.). |
| 6 | Coverage uncertainty | minor | No confirmed-coverage list for terraform providers, postgres client libs, or dart/flutter pub packages. Users hit silent misses and fall back to general web docs without knowing better fallbacks exist. | Document known-covered stacks in README or routing-table note. Name registry.terraform.io and pub.dev as specific fallbacks. |
| 7 | Agent-prompt level | minor | agents/researcher.md, agents/builder.md, and agents/reviewer.md contain zero mention of context7. Only instruction surface is routing-table (lead-consulted) and two JS/TS domain skills. Researcher and builder acting without lead routing will not self-initiate context7. | Add one-line context7 callout to agents/researcher.md rules block. |
| 8 | TDD gate | nit | Doc/config-only change. TDD-exempt. Builder did not explicitly state exemption but the category is obvious. | No action required. |

## Gate Results

- TDD gate (FEAT-011): Exempt -- doc/config change only.
- plugin-dev:plugin-validator: Applicable (.mcp.json added). CI passes validate-manifests.mjs. No structural defect.
- plugin-dev:skill-reviewer: Applicable (two SKILL.md files edited). JS and TS hints are correctly formed. Dart/flutter skills not edited -- gap is the finding, not malformation.
- Routing-table row: Checked against docs/routing-table.md per agents/reviewer.md lines 100-108.

## Summary

FEAT-016 wires context7 correctly for JS/TS. For the four user-priority stacks (postgres, terraform, dart, flutter), the integration is inadequate: dart and flutter have existing domain skills that were not updated, and postgres and terraform have no domain skill at all, leaving the routing-table as the sole fallback with JS-centric phrasing that will not trigger reliably on non-JS contexts. Four major findings require fixes before this integration is adequate for the user stated primary use cases.