---
id: FEAT-010
status: done
priority: P2
category: governance
target_release: v0.3.0
created: 2026-05-22
updated: 2026-05-22
completed: 2026-05-22
depends_on: [FEAT-007]
slices: []
derived_from: null
autonomous_safe: true
phase: 1
github_issue: 10
github_milestone: 1
---
# FEAT-010: Governance doc

## Description

Author `docs/governance.md` covering:

- Skill ownership & last-reviewed cadence
- Agent prompt size bar (≤200 lines)
- Routing-table monthly review
- Artifact retention policy
- Lessons → standards pipeline (when same lesson appears in 3+ grades
  or retrospectives, promote to skill or `code-conventions.md` entry)
- Specialist-agent admission criteria (the three-test rule from
  `docs/architecture/architecture.md` §6)

## Acceptance hints

- Each governance rule has: rule statement, why, how-to-apply.
- Linked from `README.md`.
- Quoted in `agents/lead.md` only by reference, not full text.
