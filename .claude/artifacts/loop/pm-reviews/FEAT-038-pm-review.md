---
id: FEAT-038
reviewed_at: 2026-06-05
priority: P2
autonomous_safe: false
composite_priority: 0.76
scores:
  customer_impact: 0.70
  demand_signal: 0.60
  technical_feasibility: 0.90
  scope_risk: 0.80
  strategic_alignment: 0.80
---
# PM Review — FEAT-038: Workflow badge awareness in all subagents

## Verdict

**P2 / autonomous_safe: false**

## Scoring rationale

| Dimension | Score | Evidence |
|---|---|---|
| customer_impact | 0.70 | Blocked work currently invisible in brief-me/wake-up until someone manually opens handoff files. Badge surface closes that gap. |
| demand_signal | 0.60 | Inferred from grade pattern (reliability 0.85 across last 5 slices); no direct user request. |
| technical_feasibility | 0.90 | Prompt-only additions to 5 agent files. No CLI, no schema, no test-surface risk. |
| scope_risk | 0.80 | Additive only. ≤300-line cap gives headroom. Consistent structure across agents reduces authoring drift. |
| strategic_alignment | 0.80 | Directly improves observability (brief-me signal) and reliability (blocks don't disappear silently). |

Composite: **(0.70 + 0.60 + 0.90 + 0.80 + 0.80) / 5 = 0.76**

## Scope challenge

Minimal: add one ~10-line section per agent. Could scope to 3 agents (builder, reviewer, validator) and defer deployer + researcher if line budget is tight, but the full 5-agent pass is cleaner and the line cost is small.

## Risk radar

- **autonomous_safe: false** — agent prompt edits per CLAUDE.md governance rule. Human review required on reviewer approval.
- **Revert risk: low** — additive prompt text; removing a section is trivial.
- **Interaction risk: low** — no code changes; cannot break CI gates.

## Suggested dependencies

Implement before or alongside FEAT-039 (tag-aware skill loading) since both touch the same agent files. Bundle as parallel dispatches if implemented in the same slice.
