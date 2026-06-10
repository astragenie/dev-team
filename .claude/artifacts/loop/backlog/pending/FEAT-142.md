---
id: FEAT-142
status: pending
priority: null
category: design
target_release: null
created: 2026-06-10
updated: 2026-06-10
depends_on: []
slices: []
derived_from: null
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
