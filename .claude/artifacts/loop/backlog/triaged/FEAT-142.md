---
id: FEAT-142
status: triaged
priority: P2
category: design
target_release: null
created: 2026-06-10
updated: 2026-06-10
depends_on: []
slices: []
derived_from: null
pm_customer_impact: 0.72
pm_effort_estimate: 0.5
pm_strategic_alignment: 0.78
pm_technical_risk: 0.52
pm_dependency_depth: 0.2
composite_score: 0.674
autonomous_safe: false
triage_notes: "via=pm | \"Moderate impact (design quality); low effort (agent prompt edits, no new skill); agent-prompt edits => human review\""
---
# FEAT-142: Adversarial design lenses for architect + architect-reviewer

## Description

Targets grade dimension architecture_quality (avg 0.73). The architect
produces one design; architect-reviewer evaluates that single proposal.
Neither is forced to generate or attack alternatives, so plausible-but-weak
designs survive review.

Add structured adversarial requirements:

1. **Architect**: for non-trivial designs, present >=3 meaningfully different
   options before recommending one (already partially in brainstorming;
   enforce at ADR level).
2. **Architect-reviewer**: argue *against* each leading option (inversion —
   "how does this fail?"), assess second-order effects at 6-month and 2-year
   horizons, and state confidence per major claim with what evidence would
   change it.

## Deliverables

- Architect prompt addition: multi-option ADR requirement + template section.
- Architect-reviewer prompt addition: adversarial lens checklist (refute,
  second-order, confidence calibration).
- Keep both within the 300-line agent cap — push specifics into
  `skills/domain/architecture-advisory/` if needed.

Source pattern: claude-code-templates `utilities/ultra-think.md`
(competing solutions, adversarial testing, second-order effects,
confidence calibration).
