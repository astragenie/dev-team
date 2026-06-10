---
id: FEAT-139
reviewed_at: 2026-06-10
via: pm
priority: P2
autonomous_safe: false
composite_score: 0.6975
scores:
  customer_impact: 0.75
  effort_estimate: 0.55
  strategic_alignment: 0.85
  technical_risk: 0.50
  dependency_depth: 0.20
---
# PM Review — FEAT-139: qa-expert test-quality lens (flaky-test detection + mutation bar)

## Verdict

**P2 / autonomous_safe: false** — composite 0.6975

## Scoring rationale

| Dimension | Score | Evidence |
|---|---|---|
| customer_impact | 0.75 | Targets weakest grade dimension — test_confidence 0.76 (5-slice avg) vs 0.80 threshold. |
| effort_estimate | 0.55 | One new workflow skill (≤200 lines) + qa-expert prompt rows + routing-table row. No subagent dispatch. |
| strategic_alignment | 0.85 | Directly closes a measured quality gap; aligns with the grade-driven backlog. |
| technical_risk | 0.50 | Flaky-detection heuristics risk false positives; mutation testing adds an external tool dependency. |
| dependency_depth | 0.20 | Self-contained; no upstream FEAT blockers. |

## Scope challenge

Mutation-testing gate must stay **advisory** (survival analysis as evidence only) to avoid
CI flakiness from an unproven external tool. AC should cover concrete flaky-pattern fixtures
(shared state, unawaited async, order dependence).

## Risk radar

- **autonomous_safe: false** — skill authorship per CLAUDE.md backlog-discipline clause; needs human-in-loop review.
- Rollback trivial (git revert of skill + prompt rows).
