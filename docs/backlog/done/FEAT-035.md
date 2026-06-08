---
id: FEAT-035
title: Agent prompt quality bar + cap raise + lean-agent enrichment
priority: P1
status: done
category: quality
target_release: v0.6.0
created: 2026-06-02
updated: 2026-06-02
depends_on: []
slices: [SLICE-14]
derived_from: null
autonomous_safe: false
github_issue: 49
github_milestone: null
github_url: "https://github.com/sergeymilashico/hero-crew/issues/49"
---
## Description

The agent prompt soft cap of ≤200 lines (per `docs/governance.md`) is
not enforced by any validator and three of six agent prompts
(`researcher.md` 74, `deployer.md` 82, `validator.md` 100) are far
below it. Lean agents miss context-efficiency rules, shell pre-checks,
and CLI-block guidance that the heavier builder/reviewer prompts
benefit from. Raise the cap to 300, add a CI validator, and enrich
the three lean prompts to bring them closer to the team's quality
floor.

## Acceptance hints

- New `scripts/validate-agents.mjs` mirrors `validate-skills.mjs`:
  required frontmatter (name + description + model), required sections
  (identity + Report contract), ≤300-line cap.
- `docs/governance.md` cap text updated from ≤200 to ≤300.
- `CLAUDE.md` "lead agent prompt is capped at ≤200 lines" reference
  updated.
- `docs/architecture/architecture.md` ≤200 references updated to ≤300.
- New validator wired into `.github/workflows/test.yml` as a CI gate
  and reflected in the CLAUDE.md CI gate list.
- `agents/researcher.md` enriched with context-efficiency rules,
  repo-layout-on-start, research-depth threshold.
- `agents/deployer.md` enriched with deployment-check CLI block,
  shell pre-check, context-efficiency, rollback discipline.
- `agents/validator.md` enriched with context-efficiency, shell pre-check,
  validation-depth control, gstack /qa integration note,
  repo-layout-on-start.
- Tests for `validate-agents.mjs` cover frontmatter/section/line-cap
  checks.
- CHANGELOG v0.6.0 entry.
- All six agent prompts remain ≤300 lines after the additions.

## Notes

- autonomous_safe: false — three agent prompt edits + a new CI gate.
- Pairs with the still-open lead.md slim refactor (separate FEAT) and
  the FEAT-034 complexity refactor (separate FEAT).
