---
id: FEAT-147
status: cancelled
priority: P1
category: quality
target_release: null
created: 2026-06-10
updated: 2026-06-10
cancelled: 2026-06-10
cancellation_reason: "User cancelled via /loop:auto walker review."
depends_on: []
slices: []
derived_from: null
pm_customer_impact: 0.6
pm_effort_estimate: 0.3
pm_strategic_alignment: 0.9
pm_technical_risk: 0.25
pm_dependency_depth: 0.15
composite_score: 0.7375
autonomous_safe: false
triage_notes: "CI hard-gate compliance; mechanical relocation into skills (no behavior deleted). autonomous_safe=false: governance declares agent-prompt edits human-in-loop even for relocation. P1 = active gate breach."
---
# FEAT-147: Agent prompt cap compliance: trim lead.md (347) and reviewer.md (314) under 300 via skills

agents/lead.md (347 lines) and agents/reviewer.md (314) breach the 300-line governance cap (docs/governance.md, validate-agents.ts). Relocate specifics into skills per the repo's own pattern ('specifics live in skills the agent invokes on demand'):

- lead.md: move '## Delegation thresholds (cost discipline)' + '## Context efficiency' sections into skills/meta/lead-efficiency/SKILL.md (tier: meta, <=200 lines); replace with a 4-5 line pointer. lead.md has grown since (333 -> 347) — re-measure sections at implementation time; may need one more section relocated.
- reviewer.md: move '## SPLIT_BUILD conformance sections' into skills/workflow/split-build-review/SKILL.md (tier: workflow); replace with pointer invoked on SPLIT_BUILD slices.
- Update prompt-content tests asserting on moved sections (assert pointer in agent + headings in skill); add routing-table rows ('Lead dispatch-cost decision' -> lead-efficiency, 'SPLIT_BUILD slice review' -> split-build-review).

No behavior content deleted — relocation only. AC: validate-agents + validate-skills green; all agents <=300 lines; prompt-content tests updated in same change.
(Task-level detail: docs/superpowers/plans/2026-06-10-test-ci-wallclock-maintenance.md Tasks 12-13.)