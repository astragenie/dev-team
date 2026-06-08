---
id: FEAT-125
title: "Wire plugin-dev review skills into crew:reviewer/crew:validator for plugin work"
priority: P2
status: triaged
category: feature
target_release: null
autonomous_safe: false
cross_repo: null
parent_spec: null
plan: null
related: []
phase: null
tags: ["surface:agents", "surface:skills", "concern:review", "concern:plugin-quality"]
pm_customer_impact: 0.5
pm_demand_signal: 0.4
pm_technical_feasibility: 0.6
pm_scope_risk: 0.55
pm_strategic_alignment: 0.55
pm_composite: 0.52
updated: 2026-06-07
created: 2026-06-07
triaged_at: 2026-06-07
triage_notes: "autonomous_safe=false: edits to crew:reviewer + crew:validator agent prompts (lead/reviewer family) — human-in-loop mandatory per backlog-discipline; Path A vs B design decision required first."
slices: []
depends_on: []
github_issue: 113
github_milestone: null
github_url: "https://github.com/sergeymilashico/hero-crew/issues/113"
---
# Wire plugin-dev review skills into crew:reviewer/crew:validator for plugin work

External `plugin-dev` plugin ships two high-value review skills:

- `plugin-dev:plugin-validator` — agent: plugin.json structure, manifest
  sanity, file layout
- `plugin-dev:skill-reviewer` — agent: SKILL.md quality, triggering
  effectiveness, description optimization
- `plugin-dev:plugin-structure`, `plugin-dev:skill-development`,
  `plugin-dev:agent-development`, `plugin-dev:hook-development`,
  `plugin-dev:command-development` — skills with best-practice guidance

Currently `crew:reviewer` references these as **narrative** review aids
(per CLAUDE.md) but routing is informal. When working **on** hero-crew or
loop repos, reviewer/validator should auto-dispatch plugin-dev skills.

## Two paths (pick one in design)

**Path A — Route to plugin-dev agents on plugin-context detection**
- Reviewer detects plugin context (presence of `plugin.json`,
  `.claude-plugin/`, `agents/`, `skills/` dirs at repo root)
- Auto-dispatch `plugin-dev:plugin-validator` + `plugin-dev:skill-reviewer`
  as sub-reviewers
- Aggregate findings into single review artifact
- Pro: zero content duplication, always latest from plugin-dev
- Con: hard dependency on plugin-dev being installed

**Path B — Extract guidance into local skills**
- New `skills/workflow/plugin-review/SKILL.md` mirrors plugin-dev best
  practices
- `crew:reviewer` consults it when plugin context detected
- Pro: no external dep
- Con: drift risk; needs sync mechanism

## Acceptance criteria

- [ ] Design doc picks Path A or B with rationale
- [ ] `docs/routing-table.md` row: "Plugin shape change /
      Skill shape change → crew:reviewer consults
      `plugin-dev:plugin-validator` + `plugin-dev:skill-reviewer`"
      (or local equivalent if Path B)
- [ ] `agents/reviewer.md` updated with detection trigger
- [ ] `agents/validator.md` updated if behavior-level plugin checks apply
- [ ] Self-test: run review on hero-crew itself; plugin-dev skills fire
- [ ] CHANGELOG entry

## Out of scope

- Forking plugin-dev content
- Building a plugin-test runtime
- Reviewing plugins outside hero-crew/loop family
