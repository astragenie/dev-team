---
id: FEAT-147
reviewed_at: 2026-06-10
via: pm
priority: P1
autonomous_safe: false
composite_score: 0.7375
scores:
  customer_impact: 0.6
  effort_estimate: 0.3
  strategic_alignment: 0.9
  technical_risk: 0.25
  dependency_depth: 0.15
---
# PM Review — FEAT-147: Agent prompt cap compliance (trim lead.md + reviewer.md <300 via skills)

## Verdict

**P1 / autonomous_safe: false** — composite 0.7375

## Scoring rationale

| Dimension | Score | Evidence |
|---|---|---|
| customer_impact | 0.6 | CI hard gate (`validate-agents.ts`) fails on >300-line agents; lead.md=347, reviewer.md=314 both breach. Internal/governance, not external user. |
| effort_estimate | 0.3 | Mechanical relocation into two new skills + pointer + test/routing-table updates; no new behavior. |
| strategic_alignment | 0.9 | Compliance + the repo's own "specifics live in skills" pattern + skill-taxonomy discipline. |
| technical_risk | 0.25 | Relocation only; risk is pointer/skill-name drift and test sync, both caught by prompt-content tests. |
| dependency_depth | 0.15 | Independent; touches routing-table + two new skills. |

## Scope challenge

lead.md `## Delegation thresholds` + `## Context efficiency` → `skills/meta/lead-efficiency/SKILL.md` (≤200 lines); reviewer.md `## SPLIT_BUILD conformance` → `skills/workflow/split-build-review/SKILL.md`. Replace with 4–5 line pointers; update prompt-content tests (pointer in agent + headings in skill); add routing-table rows. No behavior content deleted. Re-measure lead.md sections at implementation time (333→347 drift; may need one more section relocated).

## Risk radar

- **autonomous_safe: false** — governance.md declares agent-prompt edits human-in-loop even for relocation; reviewer must be independent of the author.
- Pointer/skill-name drift → wrong or silent skill invocation; routing-table rows + tests mandatory.
- New skills need clear AC or prompt-content tests fail; dispatch loop:spec-writer if AC weak.
- Update prompt-content tests in the same commit (validate-agents may pass on line count while old assertions break).
