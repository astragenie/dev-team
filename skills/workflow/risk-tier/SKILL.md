---
name: risk-tier
prompt_id: risk-tier
version: 1.0.0
tier: workflow
description: Risk-based tier lookup table (dispatch budget, artifact set, gate ladder), SLA caps for re-dispatch loops, and confidence aggregation formula for slice-close synthesis.
owner: sergeymilashico
last_reviewed: 2026-06-13
triggers: ["risk tier", "dispatch budget", "SLA cap", "confidence aggregation", "HIGH", "MEDIUM", "LOW tier"]
---

# Risk Tier

## Trigger

Load when the dispatcher needs to look up dispatch budget, artifact requirements, gate ladder, SLA caps, or confidence aggregation for a slice.

## Risk-Based Tier (lookup table — risk is set in slice frontmatter)

The `risk:` value in the slice frontmatter is the source of truth (computed by `loop slice from-feature` from FEAT tags + PM scores per loop FEAT-184). Look up the dispatch budget, artifact set, and gate ladder. Do not re-classify. The signals that drive the classification live in `loop slice from-feature` — your job is propagation, not verification.

| Risk   | Dispatch budget | Artifacts                                                                                                  | Gate ladder                                                                |
| ------ | --------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| LOW    | 1–2             | run brief + handoff                                                                                        | `crew:reviewer` + `crew:verifier` concurrent                              |
| MEDIUM | 2–4             | run brief + handoff + review-result + validation-result                                                    | fullstack-dev → reviewer + verifier concurrent                                  |
| HIGH   | 4–7             | full set: run brief + handoff + review-result + validation plan/result + deployment-check + final-synthesis | architect → fullstack-dev → fan-out review (2+ lenses) → verifier → release-engineer |

**Hard cap: 7 dispatches per slice.** A slice exceeding 7 = too wide; dispatch `crew:document-writer` with `escalated_to_parent: scope exceeds dispatch budget` so a human re-scopes.

## SLA Caps (prevent infinite loops)

| Loop                       | Max attempts | After cap                                                                  |
| -------------------------- | ------------ | -------------------------------------------------------------------------- |
| Fullstack-dev re-dispatch on fix | 2            | Dispatch `crew:architect` to re-scope; architect's ADR drives next fullstack-dev |
| Reviewer re-review         | 2            | Dispatch `crew:architect-reviewer` for independent design review  |
| Verifier re-run after fix | 2            | Mark `blocked` with the persistent failure evidence; route to architect    |

## Confidence Aggregation

When dispatching `crew:document-writer` for the slice-close synthesis, compute slice confidence from subagent completion reports and pass it in the dispatch prompt:

```
slice_confidence = 0.2 * dev_confidence
                 + 0.4 * reviewer_confidence
                 + 0.4 * verifier_confidence
```

Tier-specific floors:
- LOW: ≥ 0.6 to ship
- MEDIUM: ≥ 0.7 to ship
- HIGH: ≥ 0.8 to ship

Below tier floor but ≥ 0.4 → mark `blocked` with the lens that scored lowest as the named risk; re-dispatch only that lens.

Below 0.4 on any single lens → escalate to user per the Autonomous resolution escalation criterion #2 ("irreversible destructive action" interpretation: ship-decision IS the destructive action here).

If a subagent omits confidence: default to 0.5 (treated as ambiguous, surface in synthesis as `confidence_missing: <agent>`).

## Done

Tier lookup is complete when:

- dispatch budget, artifact set, and gate ladder have been looked up from the table above
- SLA cap has been checked before any re-dispatch of the same role
- confidence aggregation has been computed and passed to `crew:document-writer` at slice close
