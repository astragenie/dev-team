---
id: FEAT-142
status: in-progress
priority: P2
category: design
target_release: null
created: 2026-06-10
updated: 2026-06-20
depends_on: []
slices: [SLICE-87]
derived_from: null
pm_customer_impact: 0.6
pm_effort_estimate: 0.45
pm_strategic_alignment: 0.72
pm_technical_risk: 0.5
pm_dependency_depth: 0.2
composite_score: 0.625
autonomous_safe: false
triage_notes: "via=pm retriage 2026-06-10 | FEAT body cites architecture_quality avg 0.73, but snapshot 5-grade avg = 0.82 (above 0.80 bar). Weak-dim trigger does NOT fire — customer_impact lowered to 0.60. Adversarial design lenses are still valuable hygiene but not the bleeding edge. Risk band 0.50: agent prompt edits (architect + architect-reviewer) + optional skill addition; multi-option ADR template is a process change with adoption friction. autonomous_safe=false: agent prompt authorship per CLAUDE.md governance. Pre-mortem: (1) two weeks later — architects checkbox-complete the >=3 options requirement with weak alternatives, defeating the purpose; AC needs a sample-quality criterion (reviewer rejects single-option ADRs). (2) Rollback = git revert agent prompt edits, trivial. (3) Test gap: no test exercises architect output structure — AC should require lint-check on ADR template. Cost analog: SLICE-65 prompt-only $3.22/15.4min — effort 0.45 confirmed."
started_at: 2026-06-20
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
