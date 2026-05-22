---
id: FEAT-011
status: pending
priority: P1
category: workflow
target_release: v0.2.0
created: 2026-05-22
updated: 2026-05-22
depends_on: []
slices: []
derived_from: null
autonomous_safe: false
phase: 2
---

# FEAT-011: TDD discipline — selectively, not universally

## Description

Document and enforce a **scoped** TDD policy. Honest baseline: most
session work has been "implement → test → fix → ship". For refactors
of code with existing tests this is fine; the suite is the contract.
For **new behavior** TDD catches regressions early and shapes the
public surface before implementation locks it in.

Update `agents/builder.md` (and `skills/workflow/tdd/` if authored) to
state:

- **TDD required**: net-new feature (new behavior, new public function,
  new artifact kind, new CLI subcommand).
- **TDD optional**: refactor where existing tests cover behavior;
  doc-only changes; build/lint/CI tweaks.
- **TDD skipped with explicit note** in handoff/review when chosen.

Reference superpowers skill
`test-driven-development` (already installed at
`~/.claude/plugins/cache/claude-plugins-official/superpowers/<v>/skills/test-driven-development/SKILL.md`)
as the procedure of record.

## Acceptance hints

- `agents/builder.md` gains a "TDD policy" section ≤ 20 lines.
- A new skill `skills/workflow/tdd/SKILL.md` (or a clear pointer to
  the superpowers skill) is referenced.
- Reviewer's checklist gains one bullet: "for net-new behavior, was
  a failing test written first?"
- Lead's routing-table guidance for builds touching net-new behavior
  mentions TDD as the default.
- No retroactive enforcement on past work.

## Why not autonomous-safe

Edits the builder agent prompt and changes review discipline; needs
explicit human sign-off.
