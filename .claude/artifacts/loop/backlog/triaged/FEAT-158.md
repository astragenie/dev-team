---
id: FEAT-158
status: triaged
priority: P1
category: quality
target_release: null
created: 2026-06-11
updated: 2026-06-11
depends_on: []
slices: []
derived_from: null
autonomous_safe: false
tags: [refactor, governance, lead-orchestration]
pm_customer_impact: 0.55
pm_effort_estimate: 0.4
pm_strategic_alignment: 0.65
pm_technical_risk: 0.4
pm_dependency_depth: 0.9
triage_notes: "Lead slim-down from OpenAI review (-0.5 score) is high-touch refactor: 5 new workflow skills, every primary agent prompt's skill-load table touched, semantic-preservation risk on routing decisions; v0.33.0 already shipped lead.md tweaks so coordinate or wait."
---
# FEAT-158: Move lead policy to workflow skills (lead.md slim-down)

## Description

OpenAI review of `agents/lead.md` (8.7/10) flagged "too much embedded
policy" as the #1 improvement opportunity (-0.5 score impact). Lead
currently inlines content that belongs in skills/workflow/:

- Tag-to-agent mapping table (~25 lines)
- Fan-out review rules
- Risk-tier gate ladder
- Validator dispatch decision
- Delegation thresholds

Move each block to its own skill under `skills/workflow/`, reference
from lead via skill activation. Lead role prompt should focus on
identity + Golden Path + cross-cutting boundaries; policy details
move to skills that compose at runtime per CLAUDE.md skill taxonomy.

Target: lead.md ≤200 lines (currently 278).

## Acceptance hints

- New skills under `skills/workflow/lead-routing/`,
  `skills/workflow/fan-out-review/`, `skills/workflow/risk-tier/`,
  `skills/workflow/validator-gate/`, `skills/workflow/delegation/`
  (subset OK; pick the highest-value ones first).
- Each skill is loadable via Skill tool and surfaces the same
  decision content currently inlined.
- lead.md cross-references the skills instead of inlining content.
- Validator still green; all 17 agent prompts still pass
  validate-agents.ts maxLines + structural checks.
- No semantic change to routing decisions — only the location of
  the policy moves.
- Document the move in CHANGELOG so subagent prompts that referenced
  inline sections are updated.

## Notes

Source: OpenAI review 2026-06-11 commit `f554a16`. autonomous_safe=false
because the change touches every primary agent prompt to align their
skill-load tables with the new workflow skills.
