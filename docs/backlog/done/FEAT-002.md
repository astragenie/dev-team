---
id: FEAT-002
status: done
priority: P0
category: foundation
target_release: v0.2.0
created: 2026-05-22
updated: 2026-05-22
completed: 2026-05-22
depends_on: [FEAT-001]
slices: []
derived_from: null
autonomous_safe: true
phase: 1
github_issue: 2
github_milestone: 1
---
# FEAT-002: Authoritative routing table

## Description

Produce `docs/routing-table.md` — the prescriptive heuristic map the lead
consults when classifying incoming work. See `docs/architecture/architecture.md` §5
for the column shape.

Derive entries from observed task patterns in
`.claude/artifacts/crew/runs/`, `git log --oneline -100`, and any
deployer/reviewer/validator artifacts on disk.

## Acceptance hints

- 8–15 rows covering the most common signal → route mappings.
- Each row: signal, destination role, notes (skills to suggest, claims to open).
- Anything ambiguous explicitly routes to **lead**.
- Includes a row for "production promotion → always require explicit human approval".
- `agents/lead.md` references this file at session start (handled in FEAT-003).
